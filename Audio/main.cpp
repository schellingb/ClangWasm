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

#include <math.h>

// Function defined in loader.js
extern "C" void WAJS_StartAudio();

// This function is called at startup
int main(int argc, char *argv[])
{
	WAJS_StartAudio();

	return 0;
}

// This function is called by loader.js to feed audio
extern "C" bool WAFNAudio(float* sample_buffer, unsigned int samples)
{
	float *pLeft = sample_buffer, *pRight = sample_buffer + samples;
	for(unsigned int i = 0; i < samples; i++)
	{
		// Render 220 HZ sine wave at 25% volume into both channels
		static size_t waveCount;
		float wave = (((waveCount++) % 44100) / 44100.0f);
		pLeft[i] = pRight[i] = sinf(2.0f * 3.14159f * 220.0f * wave) * 0.25f;
	}
	return true;
}
