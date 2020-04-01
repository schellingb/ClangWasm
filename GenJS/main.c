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

#include <stdio.h>

#ifdef __cplusplus
#define WA_EXTERN extern "C"
#else
#define WA_EXTERN extern
#endif

// Macro to make a C function available from JavaScript
#define WA_EXPORT(name) __attribute__((used, visibility("default"), export_name(name)))

// Macro to generate a JavaScript function that can be called from C
#define WA_JS(ret, name, args, ...) WA_EXTERN __attribute__((import_module("JS"), import_name(#name "|" #args "|" #__VA_ARGS__))) ret name args;

// Create a JavaScript function that writes to the wa_log div
WA_JS(void, direct_print, (const char* pstr),
{
	document.getElementById('wa_log').innerHTML += WA.ReadHeapString(pstr).replace(/\n/g, '<br>');
});

// C function 'add' that can be called from JavaScript
WA_EXPORT("add") int add(int a, int b)
{
	return a + b;
}

// Create a JavaScript function that calls the C function above
WA_JS(void, call_add, (void),
{
	WA.print('add(2, 3): ' + WA.asm.add(2, 3) + '\n\n');
});

// Create a JavaScript function that writes the content of document.location.href into the wasm memory
WA_JS(int, get_document_location, (const char* pstr, int len),
{
	return WA.WriteHeapString(document.location.href, pstr, len)
});

// An unused JavaScript function which doesn't get included in the .wasm binary
WA_JS(void, unused_wa_js_func, (),
{
	WA.print('This text does not even get included in the .wasm file\n');
});

int main(int argc, char *argv[])
{
	char buf[256];
	int bufret;

	printf("Printing through printf\n\n");

	direct_print("Printing directly through WA_JS\n\n");

	call_add();

	printf("Requesting string document.location from JavaScript...\n");
	bufret = get_document_location(buf, sizeof(buf));
	printf("Got document.location: %s (len: %d)\n\n", buf, bufret);

	return 0;
}
