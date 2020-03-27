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

WA.print = WA.print || function (msg) { console.log(msg); };
WA.error = WA.error || function (code, msg) { WA.print('[ERROR] ' + code + ': ' + msg + '\n'); };

function abort(code, msg)
{
	WA.error(code, msg);
	throw 'abort';
}

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
var env = { memory: new WebAssembly.Memory({initial: wasmMemInitial>>16 }) };

WebAssembly.instantiate(wasmBytes, {env:env}).then(function (output)
{
	WA.asm = output.instance.exports;

	if (WA.asm.__wasm_call_ctors) WA.asm.__wasm_call_ctors();
	if (WA.asm.main) WA.asm.main(0, 0, 0);
	if (WA.started) WA.started();
})
.catch(function (err)
{
	if (err !== 'abort') abort('BOOT', 'WASM instiantate error: ' + err + (err.stack ? "\n" + err.stack : ''));
});

});
