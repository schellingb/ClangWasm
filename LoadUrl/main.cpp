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

// Function defined in loader.js
extern "C" void WAJS_AsyncLoad(const char* url, void* userdata = NULL, char* postdata = NULL, size_t postlength = 0, unsigned int timeout = 0);

// This function is called at startup
int main(int argc, char *argv[])
{
	const char* url = "http://zillalib.github.io/TEST.TXT";
	printf("Requesting url '%s' ...\n", url);
	WAJS_AsyncLoad(url);
	printf("Sent async request, waiting for response\n");

	return 0;
}

// This function is called by loader.js when the HTTP request finishes (or has an error)
extern "C" void WAFNHTTP(int status, char* data, size_t length, void* userdata)
{
	printf("Received response - status: %d - length: %d - data: '%.*s'\n", status, (int)length, (int)length, data);
}
