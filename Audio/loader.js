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

fetch(WA.module).then(res => res.arrayBuffer()).then(function(wasmBytes){'use strict';wasmBytes = new Uint8Array(wasmBytes);

var ABORT = false;
var HEAP32, HEAPU8, HEAPU16, HEAPU32, HEAPF32;
var WASM_MEMORY, WASM_HEAP, WASM_HEAP_MAX = 256*1024*1024; //max 256MB
WA.print = WA.print || function (msg) { console.log(msg); };
WA.error = WA.error || function (code, msg) { WA.print('[ERROR] ' + code + ': ' + msg + '\n'); };

function abort(code, msg)
{
	ABORT = true;
	WA.error(code, msg);
	throw 'abort';
}

function WriteHeapString(str, ptr, max_length)
{
	// Put a string from javascript onto the wasm memory heap (encoded as UTF8)
	if(!(0<max_length))return 0;
	for(var e=str,r=HEAPU8,f=ptr,i=max_length,a=f,t=f+i-1,b=0;b<e.length;++b)
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

function ReadHeapString(ptr, length)
{
	// Read a string from the wasm memory heap to javascript (decoded as UTF8)
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

function WAJS_WASM_IMPORTS(env)
{
	env.WAJS_StartAudio = function()
	{
		var audioCtx;
		function findAlias(el, a, b, c) { return el[a+c] || el['moz'+b+c] || el['webkit'+b+c] || el['ms'+b+c]; }
		try { audioCtx = new (findAlias(window,'','','AudioContext'))(); } catch (e) { }
		if (!audioCtx) { WA.print('Warning: WebAudio not supported\n'); return; }
		var encTime = 0, audioSamples = 882, audioSecs = audioSamples/44100;
		var ptrTempBuf = 0, f32TempBuf = 0, audioBufs = [{'length':0}], audioBufIdx = 0;
		setInterval(function()
		{
			if (audioCtx.state == 'suspended') { audioCtx.resume(); if (audioCtx.state == 'suspended') return; }
			var ctxTime = audioCtx.currentTime;
			if (ctxTime == 0) encTime = 0;
			if (encTime - ctxTime > audioSecs) return;
			if (audioBufs[0].length != audioSamples)
			{
				WA.asm.free(ptrTempBuf);
				f32TempBuf = ((ptrTempBuf = WA.asm.malloc(audioSamples<<3))>>2); //2 channels, 4 byte per float sized sample
				for (var i = 0; i != 4; i++) audioBufs[i] = audioCtx.createBuffer(2, audioSamples, 44100);
			}
			if (WA.asm.WAFNAudio(ptrTempBuf, audioSamples))
			{
				var soundBuffer = audioBufs[audioBufIdx = ((audioBufIdx + 1) % 4)];
				soundBuffer.getChannelData(0).set(HEAPF32.subarray(f32TempBuf, f32TempBuf + audioSamples));
				soundBuffer.getChannelData(1).set(HEAPF32.subarray(f32TempBuf + audioSamples, f32TempBuf + (audioSamples<<1)));
				var source = audioCtx.createBufferSource();
				source.connect(audioCtx.destination);
				source.buffer = soundBuffer;
				source[source.start ? 'start' : 'noteOn'](0.005+encTime);
			}
			if (ctxTime > encTime && ctxTime > .5)
			{
				//WA.print('Warning: Audio starved once by ' + (ctxTime - encTime) + ' seconds (ctxTime = ' + ctxTime + ', encTime = ' + encTime + ', document.hasFocus = ' + document.hasFocus() + ')\n');
				if (ctxTime - encTime < audioSecs * 10 && audioSamples < 11025 && document.hasFocus())
				{
					//only increase buffer when at least some time has passed (not directly after loading) and it's not a giant hickup
					audioSecs = (audioSamples += 441)/44100;
					WA.print('Warning: Audio callback had starved sending audio by ' + (ctxTime - encTime) + ' seconds. (extending samples to: ' + audioSamples + ')\n');
				}
				encTime = ctxTime + (document.hasFocus() ? 0 : 1.5);
			}
			encTime += audioSecs;
		}, 10);
	};
}

function MemorySetBufferViews()
{
	var buf = WASM_MEMORY.buffer;
	HEAP32 = new Int32Array(buf);
	HEAPU8 = new Uint8Array(buf);
	HEAPU16 = new Uint16Array(buf);
	HEAPU32 = new Uint32Array(buf);
	HEAPF32 = new Float32Array(buf);
}

var env =
{
	sbrk: function(increment) //called to increase the size of the memory heap
	{
		var heapOld = WASM_HEAP, heapNew = heapOld + increment, heapGrow = heapNew - WASM_MEMORY.buffer.byteLength;
		//console.log('[SBRK] Increment: ' + increment + ' - HEAP: ' + heapOld + ' -> ' + heapNew + (heapGrow > 0 ? ' - GROW BY ' + heapGrow + ' (' + (heapGrow>>16) + ' pages)' : ''));
		if (heapNew > WASM_HEAP_MAX) abort('MEM', 'Out of memory');
		if (heapGrow > 0) { WASM_MEMORY.grow((heapGrow+65535)>>16); MemorySetBufferViews(); }
		WASM_HEAP = heapNew;
		return heapOld|0;
	},
	time: function(ptr) { var ret = (Date.now()/1000)|0; if (ptr) HEAPU32[ptr>>2] = ret; return ret; },
	gettimeofday: function(ptr) { var now = Date.now(); HEAPU32[ptr>>2]=(now/1000)|0; HEAPU32[(ptr+4)>>2]=((now % 1000)*1000)|0; },
	__assert_fail:  function(condition, filename, line, func) { abort('CRASH', 'Assert ' + ReadHeapString(condition) + ', at: ' + (filename ? ReadHeapString(filename) : 'unknown filename'), line, (func ? ReadHeapString(func) : 'unknown function')); },
	__cxa_uncaught_exception: function() { abort('CRASH', 'Uncaught exception!'); },
	__cxa_pure_virtual: function() { abort('CRASH', 'pure virtual'); },
	abort: function() { abort('CRASH', 'Abort called'); },
	longjmp: function() { abort('CRASH', 'Unsupported longjmp called'); },
};
env.setjmp = env.__cxa_atexit = env.__lock = env.__unlock = function() {};
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

WAJS_WASM_IMPORTS(env);

// Calculate the required initial memory setup (data, stack, heap)
var wasmDataEnd = 64, wasmStackTop = 4096, wasmHeapBase = 65536;
for (let i = 8, sectionEnd, type, length; i < wasmBytes.length; i = sectionEnd)
{
	function Get() { return wasmBytes[i++]; }
	function GetLEB() { for (var s=i,r=0,n=128; n&128; i++) r|=((n=wasmBytes[i])&127)<<((i-s)*7); return r; }
	type = GetLEB(), length = GetLEB(), sectionEnd = i + length;
	if (type < 0 || type > 11 || length <= 0 || sectionEnd > wasmBytes.length) break;
	if (type == 6) //globals
	{
		let count = GetLEB(), gtype = Get(), mutable = Get(), opcode = GetLEB(), offset = GetLEB(), endcode = GetLEB();
		wasmHeapBase = offset;
	}
	if (type == 11) //data
	{
		for (let count = GetLEB(), j = 0; j != count && i < sectionEnd; j++)
		{
			let dindex = Get(), dopcode = GetLEB(), doffset = GetLEB(), dendcode = GetLEB(), dsize = GetLEB();
			wasmDataEnd = (doffset + dsize);
			wasmStackTop = (wasmDataEnd+15)>>4<<4;
			i += dsize;
		}
	}
}
if (wasmDataEnd <= 0 || wasmHeapBase <= wasmStackTop) abort('BOOT', 'Invalid memory layout (' + wasmDataEnd + '/' + wasmStackTop + '/' + wasmHeapBase + ')');

var wasmMemInitial = ((wasmHeapBase+65535)>>16<<16) + (256 * 1024); //start with data + stack + 256KB
WASM_HEAP = wasmHeapBase;
WASM_MEMORY = env.memory = new WebAssembly.Memory({initial: wasmMemInitial>>16, maximum: WASM_HEAP_MAX>>16 });
MemorySetBufferViews();

WebAssembly.instantiate(wasmBytes, {env:env}).then(function (output)
{
	WA.asm = output.instance.exports;

	var argc = 1, argv = wasmStackTop, exe = 'wasm';
	WriteHeapString(exe, (HEAPU32[(argv+0)>>2] = (argv+8)), 256);
	HEAPU32[(argv+4) >> 2] = 0;

	if (WA.asm.__wasm_call_ctors) WA.asm.__wasm_call_ctors();
	if (WA.asm.main) WA.asm.main(argc, argv, 0);
	if (WA.started) WA.started();
})
.catch(function (err)
{
	if (err !== 'abort') abort('BOOT', 'WASM instiantate error: ' + err + (err.stack ? "\n" + err.stack : ''));
});

});
