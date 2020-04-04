/*
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
*/

// Fetch the .wasm file and store its bytes into the byte array wasmBytes
fetch(WA.module).then(res => res.arrayBuffer()).then(function(wasmBytes){'use strict';wasmBytes = new Uint8Array(wasmBytes);

// Some global state variables and max heap definition
var HEAP32, HEAPU8, HEAPU16, HEAPU32, HEAPF32;
var WASM_MEMORY, WASM_HEAP, WASM_HEAP_MAX = 256*1024*1024; //max 256MB

// Define print and error functions if not yet defined by the outer html file
WA.print = WA.print || function (msg) { console.log(msg); };
WA.error = WA.error || function (code, msg) { WA.print('[ERROR] ' + code + ': ' + msg + '\n'); };

// A generic abort function that if called stops the execution of the program and shows an error
function abort(code, msg)
{
	WA.error(code, msg);
	throw 'abort';
}

// Puts a string from javascript onto the wasm memory heap (encoded as UTF8) (max_length is optional)
function WriteHeapString(str, ptr, max_length)
{
	for (var e=str,r=HEAPU8,f=ptr,i=(max_length?max_length:HEAPU8.length),a=f,t=f+i-1,b=0;b<e.length;++b)
	{
		var k=e.charCodeAt(b);
		if(55296<=k&&k<=57343&&(k=65536+((1023&k)<<10)|1023&e.charCodeAt(++b)),k<=127){if(t<=f)break;r[f++]=k;}
		else if(k<=2047){if(t<=f+1)break;r[f++]=192|k>>6,r[f++]=128|63&k;}
		else if(k<=65535){if(t<=f+2)break;r[f++]=224|k>>12,r[f++]=128|k>>6&63,r[f++]=128|63&k;}
		else if(k<=2097151){if(t<=f+3)break;r[f++]=240|k>>18,r[f++]=128|k>>12&63,r[f++]=128|k>>6&63,r[f++]=128|63&k;}
		else if(k<=67108863){if(t<=f+4)break;r[f++]=248|k>>24,r[f++]=128|k>>18&63,r[f++]=128|k>>12&63,r[f++]=128|k>>6&63,r[f++]=128|63&k;}
		else{if(t<=f+5)break;r[f++]=252|k>>30,r[f++]=128|k>>24&63,r[f++]=128|k>>18&63,r[f++]=128|k>>12&63,r[f++]=128|k>>6&63,r[f++]=128|63&k;}
	}
	return r[f]=0,f-a;
}

// Reads a string from the wasm memory heap to javascript (decoded as UTF8)
function ReadHeapString(ptr, length)
{
	if (length === 0 || !ptr) return '';
	for (var hasUtf = 0, t, i = 0; !length || i != length; i++)
	{
		t = HEAPU8[((ptr)+(i))>>0];
		if (t == 0 && !length) break;
		hasUtf |= t;
	}
	if (!length) length = i;
	if (hasUtf & 128)
	{
		for(var r=HEAPU8,o=ptr,p=ptr+length,F=String.fromCharCode,e,f,i,n,C,t,a,g='';;)
		{
			if(o==p||(e=r[o++],!e)) return g;
			128&e?(f=63&r[o++],192!=(224&e)?(i=63&r[o++],224==(240&e)?e=(15&e)<<12|f<<6|i:(n=63&r[o++],240==(248&e)?e=(7&e)<<18|f<<12|i<<6|n:(C=63&r[o++],248==(252&e)?e=(3&e)<<24|f<<18|i<<12|n<<6|C:(t=63&r[o++],e=(1&e)<<30|f<<24|i<<18|n<<12|C<<6|t))),65536>e?g+=F(e):(a=e-65536,g+=F(55296|a>>10,56320|1023&a))):g+=F((31&e)<<6|f)):g+=F(e);
		}
	}
	// split up into chunks, because .apply on a huge string can overflow the stack
	for (var ret = '', curr; length > 0; ptr += 1024, length -= 1024)
		ret += String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, 1024)));
	return ret;
}

// Defines syscall emulation functions in the env and wasi object that get passed to the wasm module
function SYSCALLS_WASM_IMPORTS(env, wasi)
{
	// Function to decode Base64 encoded string to a byte array
	function Base64Decode(B)
	{
		var T=new Uint8Array(128),i,C=function(o){return T[B.charCodeAt(i+o)];};
		for (i=0;i<64;i++) T['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.charCodeAt(i)]=i;T[45]=62;T[95]=63;
		var L=B.length,PH=(B[L-2]==='='?2:(B[L-1]==='='?1:0)),a=new Uint8Array(L*3/4-PH),n=0,j=(PH>0?L-4:L),t=0;
		for (i=0;i<j;i+=4) { t = (C(0)<<18)|(C(1)<<12)|(C(2)<<6)|C(3); a[n++]=(t>>16)&255;a[n++]=(t>>8)&255;a[n++]=t&255; }
		if (PH===1) { t=(C(0)<<10)|(C(1)<<4)|(C(2)>>2); a[n]=(t>>8)&255;a[n+1]=t&255; }
		else if (PH===2) a[n]=((C(0)<<2)|(C(1)>>4))&255;
		return a;
	}

	// For the file open/file reading emulation, keep a seek cursor and the file data
	var PAYLOAD_CURSOR = 0;
	var PAYLOAD = (WA.payload ? Base64Decode(WA.payload) : new Uint8Array(0));
	delete WA.payload;

	// sys_open call to open a file (can only be used to open payload here)
	env.__sys_open = function(pPath, flags, pMode) 
	{
		// Opening just resets the seek cursor to 0
		PAYLOAD_CURSOR = 0;
		//var pathname = ReadHeapString(pPath); //read the file name passed to open
		//console.log('__sys_open open - path: ' + pathname + ' - flags: ' + flags + ' - mode: ' + HEAPU32[pMode>>2]);
		return 9; //return dummy file number
	};

	// fd_read call to read from a file (reads from payload)
	wasi.fd_read = function(fd, iov, iovcnt, pOutResult)
	{
		for (var ret = 0, i = 0; i < iovcnt; i++)
		{
			// Process list of IO commands
			var ptr = HEAPU32[((iov)+(i*8))>>2];
			var len = HEAPU32[((iov)+(i*8 + 4))>>2];
			var curr = Math.min(len, PAYLOAD.length - PAYLOAD_CURSOR);
			//console.log('fd_read - fd: ' + fd + ' - iov: ' + iov + ' - iovcnt: ' + iovcnt + ' - ptr: ' + ptr + ' - len: ' + len + ' - reading: ' + curr + ' (from ' + PAYLOAD_CURSOR + ' to ' + (PAYLOAD_CURSOR + curr) + ')');

			// Write the requested data onto the heap and advance the seek cursor
			HEAPU8.set(PAYLOAD.subarray(PAYLOAD_CURSOR, PAYLOAD_CURSOR + curr), ptr);
			PAYLOAD_CURSOR += curr;

			ret += curr;
			if (curr < len) break; // nothing more to read
		}

		// Write the amount of data actually read to the result pointer
		HEAPU32[pOutResult>>2] = ret;
		//console.log('fd_read -     ret: ' + ret);
		return 0; // no error
	};

	// fd_seek call to seek in a file (seeks in payload)
	wasi.fd_seek = function(fd, offset_low, offset_high, whence, pOutResult)
	{
		// Move seek cursor according to fseek behavior
		if (whence == 0) PAYLOAD_CURSOR = offset_low; //set
		if (whence == 1) PAYLOAD_CURSOR += offset_low; //cur
		if (whence == 2) PAYLOAD_CURSOR = PAYLOAD.length - offset_low; //end
		if (PAYLOAD_CURSOR < 0) PAYLOAD_CURSOR = 0;
		if (PAYLOAD_CURSOR > PAYLOAD.length) PAYLOAD_CURSOR = PAYLOAD.length;

		// Write the result back (write only lower 32-bit of 64-bit number)
		HEAPU32[(pOutResult+0)>>2] = PAYLOAD_CURSOR;
		HEAPU32[(pOutResult+4)>>2] = 0;
		//console.log('fd_seek - fd: ' + fd + ' - offset_high: ' + offset_high + ' - offset_low: ' + offset_low + ' - pOutResult: ' + pOutResult + ' - whence: ' +whence + ' - seek to: ' + PAYLOAD_CURSOR);
		return 0; // no error
	};

	// fd_write call to write to a file/pipe (can only be used to write to stdout here)
	wasi.fd_write = function(fd, iov, iovcnt, pOutResult)
	{
		for (var ret = 0, str = '', i = 0; i < iovcnt; i++)
		{
			// Process list of IO commands, read passed strings from heap
			var ptr = HEAPU32[((iov)+(i*8))>>2];
			var len = HEAPU32[((iov)+(i*8 + 4))>>2];
			if (len < 0) return -1;
			ret += len;
			str += ReadHeapString(ptr, len);
			//console.log('fd_write - fd: ' + fd + ' - ['+i+'][len:'+len+']: ' + ReadHeapString(ptr, len).replace(/\n/g, '\\n'));
		}

		// Print the passed string and write the number of bytes read to the result pointer
		WA.print(str);
		HEAPU32[pOutResult>>2] = ret;
		return 0; // no error
	};

	// fd_close to close a file (no real file system emulation, so this does nothing)
	wasi.fd_close = function(fd)
	{
		//console.log('fd_close - fd: ' + fd);
		return 0; // no error
	};

	// sys_fcntl64 and sys_ioctl set file and IO modes/flags which are not emulated here
	env.__sys_fcntl64 = env.__sys_ioctl = function(fd, param)
	{
		return 0; // no error
	};
}

// Set the array views of various data types used to read/write to the wasm memory from JavaScript
function MemorySetBufferViews()
{
	var buf = WASM_MEMORY.buffer;
	HEAP32 = new Int32Array(buf);
	HEAPU8 = new Uint8Array(buf);
	HEAPU16 = new Uint16Array(buf);
	HEAPU32 = new Uint32Array(buf);
	HEAPF32 = new Float32Array(buf);
}

// Set up the env and wasi objects that contains the functions passed to the wasm module
var env =
{
	// sbrk gets called to increase the size of the memory heap by an increment
	sbrk: function(increment)
	{
		var heapOld = WASM_HEAP, heapNew = heapOld + increment, heapGrow = heapNew - WASM_MEMORY.buffer.byteLength;
		//console.log('[SBRK] Increment: ' + increment + ' - HEAP: ' + heapOld + ' -> ' + heapNew + (heapGrow > 0 ? ' - GROW BY ' + heapGrow + ' (' + (heapGrow>>16) + ' pages)' : ''));
		if (heapNew > WASM_HEAP_MAX) abort('MEM', 'Out of memory');
		if (heapGrow > 0) { WASM_MEMORY.grow((heapGrow+65535)>>16); MemorySetBufferViews(); }
		WASM_HEAP = heapNew;
		return heapOld|0;
	},

	// Functions querying the system time
	time: function(ptr) { var ret = (Date.now()/1000)|0; if (ptr) HEAPU32[ptr>>2] = ret; return ret; },
	gettimeofday: function(ptr) { var now = Date.now(); HEAPU32[ptr>>2]=(now/1000)|0; HEAPU32[(ptr+4)>>2]=((now % 1000)*1000)|0; },

	// Various functions thet can be called from wasm that abort the program
	__assert_fail:  function(condition, filename, line, func) { abort('CRASH', 'Assert ' + ReadHeapString(condition) + ', at: ' + (filename ? ReadHeapString(filename) : 'unknown filename'), line, (func ? ReadHeapString(func) : 'unknown function')); },
	__cxa_uncaught_exception: function() { abort('CRASH', 'Uncaught exception!'); },
	__cxa_pure_virtual: function() { abort('CRASH', 'pure virtual'); },
	abort: function() { abort('CRASH', 'Abort called'); },
	longjmp: function() { abort('CRASH', 'Unsupported longjmp called'); },
}, wasi = {};

// Functions that do nothing in this wasm context
env.setjmp = env.__cxa_atexit = env.__lock = env.__unlock = function() {};

// Math functions
env.ceil = env.ceilf = Math.ceil;
env.exp = env.expf = Math.exp;
env.floor = env.floorf = Math.floor;
env.log = env.logf = Math.log;
env.pow = env.powf = Math.pow;
env.cos = env.cosf = Math.cos;
env.sin = env.sinf = Math.sin;
env.tan = env.tanf = Math.tan;
env.acos = env.acosf = Math.acos;
env.asin = env.asinf = Math.asin;
env.sqrt = env.sqrtf = Math.sqrt;
env.atan = env.atanf = Math.atan;
env.atan2 = env.atan2f = Math.atan2;
env.fabs = env.fabsf = env.abs = Math.abs;
env.round = env.roundf = env.rint = env.rintf = Math.round;

// Extend the objects with the syscall IO emulation
SYSCALLS_WASM_IMPORTS(env, wasi);

// Find the start point of the stack and the heap to calculate the initial memory requirements
var wasmDataEnd = 64, wasmStackTop = 4096, wasmHeapBase = 65536;
// This code goes through the wasm file sections according the binary encoding description
//     https://webassembly.org/docs/binary-encoding/
for (let i = 8, sectionEnd, type, length; i < wasmBytes.length; i = sectionEnd)
{
	// Get() gets the next single byte, GetLEB() gets a LEB128 variable-length number
	function Get() { return wasmBytes[i++]; }
	function GetLEB() { for (var s=i,r=0,n=128; n&128; i++) r|=((n=wasmBytes[i])&127)<<((i-s)*7); return r; }
	type = GetLEB(), length = GetLEB(), sectionEnd = i + length;
	if (type < 0 || type > 11 || length <= 0 || sectionEnd > wasmBytes.length) break;
	if (type == 6)
	{
		//Section 6 'Globals', llvm places the heap base pointer into the first value here
		let count = GetLEB(), gtype = Get(), mutable = Get(), opcode = GetLEB(), offset = GetLEB(), endcode = GetLEB();
		wasmHeapBase = offset;
	}
	if (type == 11)
	{
		//Section 11 'Data', contains data segments which the end of the last entry will indicate the start of the stack area
		for (let count = GetLEB(), j = 0; j != count && i < sectionEnd; j++)
		{
			let dindex = Get(), dopcode = GetLEB(), doffset = GetLEB(), dendcode = GetLEB(), dsize = GetLEB();
			wasmDataEnd = (doffset + dsize);
			wasmStackTop = (wasmDataEnd+15)>>4<<4;
			i += dsize;
		}
	}
}

// Validate the queried pointers
if (wasmDataEnd <= 0 || wasmHeapBase <= wasmStackTop) abort('BOOT', 'Invalid memory layout (' + wasmDataEnd + '/' + wasmStackTop + '/' + wasmHeapBase + ')');

// Set the initial wasm memory size to [DATA] + [STACK] + [256KB HEAP] (can be grown with sbrk)
var wasmMemInitial = ((wasmHeapBase+65535)>>16<<16) + (256 * 1024);
WASM_HEAP = wasmHeapBase;
WASM_MEMORY = env.memory = new WebAssembly.Memory({initial: wasmMemInitial>>16, maximum: WASM_HEAP_MAX>>16 });
MemorySetBufferViews();

// Instantiate the wasm module by passing the prepared env and wasi objects containing import functions for the wasm module
WebAssembly.instantiate(wasmBytes, {env:env,wasi_unstable:wasi,wasi_snapshot_preview1:wasi,wasi:wasi}).then(function (output)
{
	// Store the list of the functions exported by the wasm module in WA.asm
	WA.asm = output.instance.exports;

	// If function '__wasm_call_ctors' (global C++ constructors) exists, call it
	if (WA.asm.__wasm_call_ctors) WA.asm.__wasm_call_ctors();

	// If function 'main' exists, call it
	if (WA.asm.main)
	{
		// Store the argument list with 1 entry at the far end of the stack to pass to main
		var argc = 1, argv = wasmStackTop, exe = 'wasmexe';

		// Store the program name string after the argv list
		WriteHeapString(exe, (argv + 8));

		// argv[0] contains the pointer to the exe string, argv[1] has a list terminating null pointer
		HEAPU32[(argv>>2) + 0] = (argv + 8)
		HEAPU32[(argv>>2) + 1] = 0;

		WA.asm.main(argc, argv);
	}

	// If the outer HTML file supplied a 'started' callback, call it
	if (WA.started) WA.started();
})
.catch(function (err)
{
	// On an exception, if the err is 'abort' the error was already processed in the abort function above
	if (err !== 'abort') abort('BOOT', 'WASM instiantate error: ' + err + (err.stack ? "\n" + err.stack : ''));
});

});
