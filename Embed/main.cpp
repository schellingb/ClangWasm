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

#include <string>
#include <vector>
#include <stdio.h>

#define GL_GLEXT_PROTOTYPES
#define EGL_EGLEXT_PROTOTYPES
#include <GL/gl.h>
#include <math.h>

// Functions defined in loader.js
extern "C" void WAJS_SetupCanvas(int width, int height);
extern "C" unsigned int WAJS_GetTime();
extern "C" void WAJS_StartAudio();

static const char* vertex_shader_text =
	"precision lowp float;"
	"uniform mat4 uMVP;"
	"attribute vec4 aPos;"
	"attribute vec3 aCol;"
	"varying vec3 vCol;"
	"void main()"
	"{"
		"vCol = aCol;"
		"gl_Position = uMVP * aPos;"
	"}";

static const char* fragment_shader_text =
	"precision lowp float;"
	"varying vec3 vCol;"
	"void main()"
	"{"
		"gl_FragColor = vec4(vCol, 1.0);"
	"}";

typedef struct Vertex { float x, y, r, g, b; } Vertex;
static GLuint program, vertex_buffer;
static GLint uMVP_location, aPos_location, aCol_location;

// This function is called at startup
int main(int argc, char *argv[])
{

	std::string string = "Hello C++";
	string += " World";
	printf("%s\n\n", string.c_str());

	std::vector<int> vec;
	vec.push_back(1);
	vec.push_back(2);
	vec.push_back(3);
	vec.erase(vec.begin() + 1);
	for (int i : vec)
		printf("Vector element: %d\n", i);
	printf("\n");

	int* ptr = new int();
	printf("Allocated memory with new at %p\n\n", ptr);
	delete ptr;

	printf("Setting up rendering canvas...\n\n", ptr);
	WAJS_SetupCanvas(640, 480);
	glViewport(0, 0, 640, 480);

	GLuint vertex_shader = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vertex_shader, 1, &vertex_shader_text, NULL);
	glCompileShader(vertex_shader);

	GLuint fragment_shader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragment_shader, 1, &fragment_shader_text, NULL);
	glCompileShader(fragment_shader);

	program = glCreateProgram();
	glAttachShader(program, vertex_shader);
	glAttachShader(program, fragment_shader);
	glLinkProgram(program);

	uMVP_location = glGetUniformLocation(program, "uMVP");
	aPos_location = glGetAttribLocation(program, "aPos");
	aCol_location = glGetAttribLocation(program, "aCol");

	glGenBuffers(1, &vertex_buffer);
	glBindBuffer(GL_ARRAY_BUFFER, vertex_buffer);

	glEnableVertexAttribArray(aPos_location);
	glVertexAttribPointer(aPos_location, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);
	glEnableVertexAttribArray(aCol_location);
	glVertexAttribPointer(aCol_location, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)(sizeof(float) * 2));

	printf("Starting audio output...\n\n", ptr);
	WAJS_StartAudio();

	return 0;
}

// This function is called by loader.js every frame
extern "C" void WAFNDraw()
{
	float f = ((WAJS_GetTime() % 1000) / 1000.0f);

	glClear(GL_COLOR_BUFFER_BIT);

	Vertex vertices[3] =
	{
		{ -0.6f, -0.4f, 1.f, 0.f, 0.f },
		{  0.6f, -0.4f, 0.f, 1.f, 0.f },
		{   0.f,  0.6f, 0.f, 0.f, 1.f },
	};
	vertices[0].x = sinf(f * 3.14159f) * 0.6f;
	vertices[1].x = sinf(f * 3.14159f) * -0.6f;
	glBindBuffer(GL_ARRAY_BUFFER, vertex_buffer);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	GLfloat mvp[4*4] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1 };
	glUseProgram(program);
	glUniformMatrix4fv(uMVP_location, 1, GL_FALSE, mvp);
	glDrawArrays(GL_TRIANGLES, 0, 3);
}

// This function is called by loader.js to feed audio
extern "C" bool WAFNAudio(float* sample_buffer, unsigned int samples)
{
	// Render 220~440 HZ sine wave at 25% volume into both channels
	float f = ((WAJS_GetTime() % 1000) / 1000.0f);
	float delta = (220.0f * (1.5f + 0.5f * sinf(f * 3.14159f))) / 44100.0f;

	float *pLeft = sample_buffer, *pRight = sample_buffer + samples;
	for(unsigned int i = 0; i < samples; i++)
	{
		static float wave;
		wave = fmod(wave + delta, 1.0f);
		pLeft[i] = pRight[i] = sinf(2.0f * 3.14159f * wave) * 0.25f;
	}
	return true;
}
