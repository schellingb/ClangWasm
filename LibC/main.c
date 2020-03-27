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
#include <stddef.h>
#include <math.h>
#include <malloc.h>

int main(int argc, char *argv[])
{
	printf("Hello printf World\n\n");

	printf("sinf(1.0f): %f\n\n", sinf(1.0f));

	char file_buf[20] = {0};
	FILE* file = fopen("payload", "r");
	printf("Opened payload file %p\n", file);
	fseek(file, 0, SEEK_END);
	long file_size = ftell(file);
	fseek(file, 0, SEEK_SET);
	printf("Size of payload is %d\n", file_size);
	size_t file_read = fread(file_buf, 1, sizeof(file_buf), file);
	fclose(file);
	printf("Read %d bytes from file '%s'\n\n", (int)file_read, file_buf);

	void* alloc_buf = malloc(1024);
	printf("Allocated 1KB at address %p\n", alloc_buf);
	alloc_buf = realloc(alloc_buf, 10*1024*1024);
	printf("Reallocated to 10MB at address %p\n\n", alloc_buf);
	free(alloc_buf);

	return 0;
}
