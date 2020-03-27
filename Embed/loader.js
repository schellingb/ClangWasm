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

(function(){'use strict';

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

function malloc_string(s)
{
	var i, s = unescape(encodeURIComponent(s));
	var ptr = WA.asm.malloc(s.length+1);
	for (i = 0; i < s.length; ++i) HEAPU8[ptr+i] = (s.charCodeAt(i) & 0xFF);
	HEAPU8[ptr+i] = 0;
	return ptr;
}

function malloc_array(a)
{
	var ptr = WA.asm.malloc(Math.max(a.length, 1));
	if (a.subarray || a.slice) HEAPU8.set(a, ptr);
	else HEAPU8.set(new Uint8Array(a), ptr);
	return ptr;
}

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

function SYSCALLS_WASM_IMPORTS(env, wasi)
{
	var PAYLOAD_CURSOR = 0;
	var PAYLOAD = (WA.payload ? Base64Decode(WA.payload) : new Uint8Array(0));
	delete WA.payload;

	env.__sys_open = function(pPath, flags, pMode) // open file (can only be used to open payload)
	{
		PAYLOAD_CURSOR = 0;
		var pathname = ReadHeapString(pPath);
		//console.log('__sys_open open - path: ' + pathname + ' - flags: ' + flags + ' - mode: ' + HEAPU32[pMode>>2]);
		return 9;
	};

	wasi.fd_read = function(fd, iov, iovcnt, pOutResult) //read from payload
	{
		var ret = 0;
		for (var i = 0; i < iovcnt; i++)
		{
			var ptr = HEAPU32[((iov)+(i*8))>>2];
			var len = HEAPU32[((iov)+(i*8 + 4))>>2];
			var curr = Math.min(len, PAYLOAD.length - PAYLOAD_CURSOR);
			//console.log('fd_read - fd: ' + fd + ' - iov: ' + iov + ' - iovcnt: ' + iovcnt + ' - ptr: ' + ptr + ' - len: ' + len + ' - reading: ' + curr + ' (from ' + PAYLOAD_CURSOR + ' to ' + (PAYLOAD_CURSOR + curr) + ')');

			HEAPU8.set(PAYLOAD.subarray(PAYLOAD_CURSOR, PAYLOAD_CURSOR + curr), ptr);
			PAYLOAD_CURSOR += curr;

			if (curr < 0) return 5;
			ret += curr;
			if (curr < len) break; // nothing more to read
		}
		//console.log('fd_read -     ret: ' + ret);
		HEAPU32[pOutResult>>2] = ret;
		return 0;
	};

	wasi.fd_seek = function(fd, offset_low, offset_high, whence, pOutResult) //seek in payload
	{
		if (whence == 0) PAYLOAD_CURSOR = offset_low; //set
		if (whence == 1) PAYLOAD_CURSOR += offset_low; //cur
		if (whence == 2) PAYLOAD_CURSOR = PAYLOAD.length - offset_low; //end
		if (PAYLOAD_CURSOR < 0) PAYLOAD_CURSOR = 0;
		if (PAYLOAD_CURSOR > PAYLOAD.length) PAYLOAD_CURSOR = PAYLOAD.length;
		HEAPU32[(pOutResult+0)>>2] = PAYLOAD_CURSOR;
		HEAPU32[(pOutResult+4)>>2] = 0;
		//console.log('fd_seek - fd: ' + fd + ' - offset_high: ' + offset_high + ' - offset_low: ' + offset_low + ' - pOutResult: ' + pOutResult + ' - whence: ' +whence + ' - seek to: ' + PAYLOAD_CURSOR);
		return 0;
	};

	wasi.fd_write = function(fd, iov, iovcnt, pOutResult) //can only be used to write to stdout
	{
		var ret = 0, str = '';
		if (iovcnt == 0) return 0;
		for (var i = 0; i < iovcnt; i++)
		{
			var ptr = HEAPU32[((iov)+(i*8))>>2];
			var len = HEAPU32[((iov)+(i*8 + 4))>>2];
			if (len < 0) return -1;
			ret += len;
			str += ReadHeapString(ptr, len);
			//console.log('fd_write - fd: ' + fd + ' - ['+i+'][len:'+len+']: ' + ReadHeapString(ptr, len).replace(/\n/g, '\\n'));
		}
		WA.print(str);
		HEAPU32[pOutResult>>2] = ret;
		return 0;
	};

	wasi.fd_close = function(fd)
	{
		//console.log('fd_close - fd: ' + fd);
		return 0;
	};

	env.__sys_fcntl64 = env.__sys_ioctl = function(fd, param)
	{
		return 0;
	};
}

var GLsetupContext;
function GL_WASM_IMPORTS(env)
{
	var GLctx;
	var GLcounter = 1;
	var GLbuffers = [];
	var GLprograms = [];
	var GLframebuffers = [];
	var GLtextures = [];
	var GLuniforms = [];
	var GLshaders = [];
	var GLprogramInfos = {};
	var GLpackAlignment = 4;
	var GLunpackAlignment = 4;
	var GLMINI_TEMP_BUFFER_SIZE = 256;
	var GLminiTempBuffer = null;
	var GLminiTempBufferViews = [0];
	GLminiTempBuffer = new Float32Array(GLMINI_TEMP_BUFFER_SIZE);
	for (var i = 0; i < GLMINI_TEMP_BUFFER_SIZE; i++) GLminiTempBufferViews[i] = GLminiTempBuffer.subarray(0, i+1);

	GLsetupContext = function(canvas, attr)
	{
		var attr = { majorVersion: 1, minorVersion: 0, antialias: true, alpha: false };
		var errorInfo = '';
		try
		{
			let onContextCreationError = function(event) { errorInfo = event.statusMessage || errorInfo; };
			canvas.addEventListener('webglcontextcreationerror', onContextCreationError, false);
			try { GLctx = canvas.getContext('webgl', attr) || canvas.getContext('experimental-webgl', attr); }
			finally { canvas.removeEventListener('webglcontextcreationerror', onContextCreationError, false); }
			if (!GLctx) throw 'Could not create context';
		}
		catch (e) { abort('WEBGL', e + (errorInfo ? ' (' + errorInfo + ')' : '')); }

		var exts = GLctx.getSupportedExtensions();
		if (exts && exts.length > 0)
		{
			// These are the 'safe' feature-enabling extensions that don't add any performance impact related to e.g. debugging, and
			// should be enabled by default so that client GLES2/GL code will not need to go through extra hoops to get its stuff working.
			// As new extensions are ratified at http://www.khronos.org/registry/webgl/extensions/ , feel free to add your new extensions
			// here, as long as they don't produce a performance impact for users that might not be using those extensions.
			// E.g. debugging-related extensions should probably be off by default.
			var W = 'WEBGL_', O = 'OES_', E = 'EXT_', T = 'texture_', C = 'compressed_'+T;
			var automaticallyEnabledExtensions = [ // Khronos ratified WebGL extensions ordered by number (no debug extensions):
				O+T+'float', O+T+'half_float', O+'standard_derivatives',
				O+'vertex_array_object', W+C+'s3tc', W+'depth_texture',
				O+'element_index_uint', E+T+'filter_anisotropic', E+'frag_depth',
				W+'draw_buffers', 'ANGLE_instanced_arrays', O+T+'float_linear',
				O+T+'half_float_linear', E+'blend_minmax', E+'shader_texture_lod',
				// Community approved WebGL extensions ordered by number:
				W+C+'pvrtc', E+'color_buffer_half_float', W+'color_buffer_float',
				E+'sRGB', W+C+'etc1', E+'disjoint_timer_query',
				W+C+'etc', W+C+'astc', E+'color_buffer_float',
				W+C+'s3tc_srgb', E+'disjoint_timer_query_webgl2'];
			exts.forEach(function(ext)
			{
				if (automaticallyEnabledExtensions.indexOf(ext) != -1)
				{
					// Calling .getExtension enables that extension permanently, no need to store the return value to be enabled.
					GLctx.getExtension(ext);
				}
			});
		}

		return true;
	};
	function getNewId(table)
	{
		var ret = GLcounter++;
		for (var i = table.length; i < ret; i++) table[i] = null;
		return ret;
	}
	function getSource(shader, count, string, length)
	{
		var source = '';
		for (var i = 0; i < count; ++i)
		{
			var frag;
			if (length)
			{
				var len = HEAP32[(((length)+(i*4))>>2)];
				if (len < 0) frag = ReadHeapString(HEAP32[(((string)+(i*4))>>2)]);
				else frag = ReadHeapString(HEAP32[(((string)+(i*4))>>2)], len);
			}
			else frag = ReadHeapString(HEAP32[(((string)+(i*4))>>2)]);
			source += frag;
		}
		return source;
	}
	function populateUniformTable(program)
	{
		var p = GLprograms[program];
		GLprogramInfos[program] =
		{
			uniforms: {},
			maxUniformLength: 0, // This is eagerly computed below, since we already enumerate all uniforms anyway.
			maxAttributeLength: -1, // This is lazily computed and cached, computed when/if first asked, '-1' meaning not computed yet.
			maxUniformBlockNameLength: -1 // Lazily computed as well
		};

		var ptable = GLprogramInfos[program];
		var utable = ptable.uniforms;

		// A program's uniform table maps the string name of an uniform to an integer location of that uniform.
		// The global GLuniforms map maps integer locations to WebGLUniformLocations.
		var numUniforms = GLctx.getProgramParameter(p, GLctx.ACTIVE_UNIFORMS);
		for (var i = 0; i < numUniforms; ++i)
		{
			var u = GLctx.getActiveUniform(p, i);

			var name = u.name;
			ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length+1);

			// Strip off any trailing array specifier we might have got, e.g. '[0]'.
			if (name.indexOf(']', name.length-1) !== -1)
			{
				var ls = name.lastIndexOf('[');
				name = name.slice(0, ls);
			}

			// Optimize memory usage slightly: If we have an array of uniforms, e.g. 'vec3 colors[3];', then
			// only store the string 'colors' in utable, and 'colors[0]', 'colors[1]' and 'colors[2]' will be parsed as 'colors'+i.
			// Note that for the GLuniforms table, we still need to fetch the all WebGLUniformLocations for all the indices.
			var loc = GLctx.getUniformLocation(p, name);
			if (loc != null)
			{
				var id = getNewId(GLuniforms);
				utable[name] = [u.size, id];
				GLuniforms[id] = loc;

				for (var j = 1; j < u.size; ++j)
				{
					var n = name + '['+j+']';
					loc = GLctx.getUniformLocation(p, n);
					id = getNewId(GLuniforms);

					GLuniforms[id] = loc;
				}
			}
		}
	}
	function GLrecordError(err)
	{
		if (!GLlastError) GLlastError = err;
	}

	env.glActiveTexture = function(x0) { GLctx.activeTexture(x0); };
	env.glAttachShader = function(program, shader) { GLctx.attachShader(GLprograms[program], GLshaders[shader]); };
	env.glBindAttribLocation = function(program, index, name) { GLctx.bindAttribLocation(GLprograms[program], index, ReadHeapString(name)); };
	env.glBindBuffer = function(target, buffer) { GLctx.bindBuffer(target, buffer ? GLbuffers[buffer] : null); };
	env.glBindFramebuffer = function(target, framebuffer) { GLctx.bindFramebuffer(target, framebuffer ? GLframebuffers[framebuffer] : null); };
	env.glBindTexture = function(target, texture) { GLctx.bindTexture(target, texture ? GLtextures[texture] : null); };
	env.glBlendFunc = function(x0, x1) { GLctx.blendFunc(x0, x1); };
	env.glBlendFuncSeparate = function(x0, x1, x2, x3) { GLctx.blendFuncSeparate(x0, x1, x2, x3); }
	env.glBlendColor = function(x0, x1, x2, x3) { GLctx.blendColor(x0, x1, x2, x3); }
	env.glBlendEquation = function(x0) { GLctx.blendEquation(x0); }
	env.glBlendEquationSeparate = function(x0, x1) { GLctx.blendEquationSeparate(x0, x1); }

	env.glBufferData = function(target, size, data, usage)
	{
		if (!data) GLctx.bufferData(target, size, usage);
		else GLctx.bufferData(target, HEAPU8.subarray(data, data+size), usage);
	};

	env.glBufferSubData = function(target, offset, size, data) { GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data+size)); };
	env.glClear = function(x0) { GLctx.clear(x0); };
	env.glClearColor = function(x0, x1, x2, x3) { GLctx.clearColor(x0, x1, x2, x3); };
	env.glColorMask = function(red, green, blue, alpha) { GLctx.colorMask(!!red, !!green, !!blue, !!alpha); };
	env.glCompileShader = function(shader) { GLctx.compileShader(GLshaders[shader]); };

	env.glCreateProgram = function()
	{
		var id = getNewId(GLprograms);
		var program = GLctx.createProgram();
		program.name = id;
		GLprograms[id] = program;
		return id;
	};

	env.glCreateShader = function(shaderType)
	{
		var id = getNewId(GLshaders);
		GLshaders[id] = GLctx.createShader(shaderType);
		return id;
	};

	env.glDeleteBuffers = function(n, buffers)
	{
		for (var i = 0; i < n; i++)
		{
			var id = HEAP32[(((buffers)+(i*4))>>2)];
			var buffer = GLbuffers[id];

			// From spec: "glDeleteBuffers silently ignores 0's and names that do not correspond to existing buffer objects."
			if (!buffer) continue;

			GLctx.deleteBuffer(buffer);
			buffer.name = 0;
			GLbuffers[id] = null;
		}
	};

	env.glDeleteFramebuffers = function(n, framebuffers)
	{
		for (var i = 0; i < n; ++i)
		{
			var id = HEAP32[(((framebuffers)+(i*4))>>2)];
			var framebuffer = GLframebuffers[id];
			if (!framebuffer) continue; // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
			GLctx.deleteFramebuffer(framebuffer);
			framebuffer.name = 0;
			GLframebuffers[id] = null;
		}
	};

	env.glDeleteProgram = function(id)
	{
		if (!id) return;
		var program = GLprograms[id];
		if (!program) 
		{
			// glDeleteProgram actually signals an error when deleting a nonexisting object, unlike some other GL delete functions.
			GLrecordError(0x0501); // GL_INVALID_VALUE
			return;
		}
		GLctx.deleteProgram(program);
		program.name = 0;
		GLprograms[id] = null;
		GLprogramInfos[id] = null;
	};

	env.glDeleteShader = function(id)
	{
		if (!id) return;
		var shader = GLshaders[id];
		if (!shader)
		{
			// glDeleteShader actually signals an error when deleting a nonexisting object, unlike some other GL delete functions.
			GLrecordError(0x0501); // GL_INVALID_VALUE
			return;
		}
		GLctx.deleteShader(shader);
		GLshaders[id] = null;
	};

	env.glDeleteTextures = function(n, textures)
	{
		for (var i = 0; i < n; i++)
		{
			var id = HEAP32[(((textures)+(i*4))>>2)];
			var texture = GLtextures[id];
			if (!texture) continue; // GL spec: "glDeleteTextures silently ignores 0s and names that do not correspond to existing textures".
			GLctx.deleteTexture(texture);
			texture.name = 0;
			GLtextures[id] = null;
		}
	};

	env.glDepthFunc = function(x0) { GLctx.depthFunc(x0); };
	env.glDepthMask = function(flag) { GLctx.depthMask(!!flag); };
	env.glDetachShader = function(program, shader) { GLctx.detachShader(GLprograms[program], GLshaders[shader]); };

	env.glDisable = function(x0) { GLctx.disable(x0); };
	env.glDisableVertexAttribArray = function(index) { GLctx.disableVertexAttribArray(index); };
	env.glDrawArrays = function(mode, first, count) { GLctx.drawArrays(mode, first, count); };
	env.glDrawElements = function(mode, count, type, indices) { GLctx.drawElements(mode, count, type, indices); };
	env.glEnable = function(x0) { GLctx.enable(x0); };
	env.glEnableVertexAttribArray = function(index) { GLctx.enableVertexAttribArray(index); };
	env.glFramebufferTexture2D = function(target, attachment, textarget, texture, level) { GLctx.framebufferTexture2D(target, attachment, textarget, GLtextures[texture], level); };

	env.glGenBuffers = function(n, buffers)
	{
		for (var i = 0; i < n; i++)
		{
			var buffer = GLctx.createBuffer();
			if (!buffer)
			{
				GLrecordError(0x0502); // GL_INVALID_OPERATION
				while(i < n) HEAP32[(((buffers)+(i++*4))>>2)]=0;
				return;
			}
			var id = getNewId(GLbuffers);
			buffer.name = id;
			GLbuffers[id] = buffer;
			HEAP32[(((buffers)+(i*4))>>2)]=id;
		}
	};

	env.glGenFramebuffers = function(n, ids)
	{
		for (var i = 0; i < n; ++i)
		{
			var framebuffer = GLctx.createFramebuffer();
			if (!framebuffer)
			{
				GLrecordError(0x0502); // GL_INVALID_OPERATION
				while(i < n) HEAP32[(((ids)+(i++*4))>>2)]=0;
				return;
			}
			var id = getNewId(GLframebuffers);
			framebuffer.name = id;
			GLframebuffers[id] = framebuffer;
			HEAP32[(((ids)+(i*4))>>2)] = id;
		}
	};

	env.glGenTextures = function(n, textures)
	{
		for (var i = 0; i < n; i++)
		{
			var texture = GLctx.createTexture();
			if (!texture)
			{
				// GLES + EGL specs don't specify what should happen here, so best to issue an error and create IDs with 0.
				GLrecordError(0x0502); // GL_INVALID_OPERATION
				while(i < n) HEAP32[(((textures)+(i++*4))>>2)]=0;
				return;
			}
			var id = getNewId(GLtextures);
			texture.name = id;
			GLtextures[id] = texture;
			HEAP32[(((textures)+(i*4))>>2)]=id;
		}
	};

	env.glGetActiveUniform = function(program, index, bufSize, length, size, type, name)
	{
		program = GLprograms[program];
		var info = GLctx.getActiveUniform(program, index);
		if (!info) return; // If an error occurs, nothing will be written to length, size, type and name.

		if (bufSize > 0 && name)
		{
			var numBytesWrittenExclNull = WriteHeapString(info.name, name, bufSize);
			if (length) HEAP32[((length)>>2)]=numBytesWrittenExclNull;
		} else {
			if (length) HEAP32[((length)>>2)]=0;
		}

		if (size) HEAP32[((size)>>2)]=info.size;
		if (type) HEAP32[((type)>>2)]=info.type;
	};
	
	env.glGetAttribLocation = function(program, name)
	{
		program = GLprograms[program];
		name = ReadHeapString(name);
		return GLctx.getAttribLocation(program, name);
	};

	function webGLGet(name_, p, type)
	{
		// Guard against user passing a null pointer.
		// Note that GLES2 spec does not say anything about how passing a null pointer should be treated.
		// Testing on desktop core GL 3, the application crashes on glGetIntegerv to a null pointer, but
		// better to report an error instead of doing anything random.
		if (!p) { GLrecordError(0x0501); return; } // GL_INVALID_VALUE

		var ret = undefined;
		switch(name_)
		{
			// Handle a few trivial GLES values
			case 0x8DFA: ret = 1; break; // GL_SHADER_COMPILER
			case 0x8DF8: // GL_SHADER_BINARY_FORMATS
				if (type !== 'Integer' && type !== 'Integer64') GLrecordError(0x0500); // GL_INVALID_ENUM
				return; // Do not write anything to the out pointer, since no binary formats are supported.
			case 0x8DF9: ret = 0; break; // GL_NUM_SHADER_BINARY_FORMATS
			case 0x86A2: // GL_NUM_COMPRESSED_TEXTURE_FORMATS
				// WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be queried for length),
				// so implement it ourselves to allow C++ GLES2 code get the length.
				var formats = GLctx.getParameter(0x86A3); // GL_COMPRESSED_TEXTURE_FORMATS
				ret = formats.length;
				break;
		}

		if (ret === undefined)
		{
			var result = GLctx.getParameter(name_);
			switch (typeof(result))
			{
				case 'number':
					ret = result;
					break;
				case 'boolean':
					ret = result ? 1 : 0;
					break;
				case 'string':
					GLrecordError(0x0500); // GL_INVALID_ENUM
					return;
				case 'object':
					if (result === null)
					{
						// null is a valid result for some (e.g., which buffer is bound - perhaps nothing is bound), but otherwise
						// can mean an invalid name_, which we need to report as an error
						switch(name_)
						{
							case 0x8894: // ARRAY_BUFFER_BINDING
							case 0x8B8D: // CURRENT_PROGRAM
							case 0x8895: // ELEMENT_ARRAY_BUFFER_BINDING
							case 0x8CA6: // FRAMEBUFFER_BINDING
							case 0x8CA7: // RENDERBUFFER_BINDING
							case 0x8069: // TEXTURE_BINDING_2D
							case 0x8514: // TEXTURE_BINDING_CUBE_MAP
								ret = 0;
								break;
							default:
								GLrecordError(0x0500); // GL_INVALID_ENUM
								return;
						}
					}
					else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array)
					{
						for (var i = 0; i < result.length; ++i) {
							switch (type)
							{
								case 'Integer': HEAP32[(((p)+(i*4))>>2)]=result[i]; break;
								case 'Float':   HEAPF32[(((p)+(i*4))>>2)]=result[i]; break;
								case 'Boolean': HEAPU8[(((p)+(i))>>0)]=result[i] ? 1 : 0; break;
								default: abort('WEBGL', 'internal glGet error, bad type: ' + type);
							}
						}
						return;
					}
					else if (result instanceof WebGLBuffer || result instanceof WebGLProgram || result instanceof WebGLFramebuffer || result instanceof WebGLRenderbuffer || result instanceof WebGLTexture)
					{
						ret = result.name | 0;
					}
					else
					{
						GLrecordError(0x0500); // GL_INVALID_ENUM
						return;
					}
					break;
				default:
					GLrecordError(0x0500); // GL_INVALID_ENUM
					return;
			}
		}

		switch (type)
		{
			case 'Integer64': (tempI64 = [ret>>>0,(tempDouble=ret,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((p)>>2)]=tempI64[0],HEAP32[(((p)+(4))>>2)]=tempI64[1]); break;
			case 'Integer': HEAP32[((p)>>2)] = ret; break;
			case 'Float':   HEAPF32[((p)>>2)] = ret; break;
			case 'Boolean': HEAPU8[((p)>>0)] = ret ? 1 : 0; break;
			default: abort('WEBGL', 'internal glGet error, bad type: ' + type);
		}
	}

	env.glGetError = function()
	{
		if (GLlastError)
		{
			var e = GLlastError;
			GLlastError = 0;
			return e;
		}
		return GLctx.getError();
	};

	env.glGetIntegerv = function(name_, p)
	{
		webGLGet(name_, p, 'Integer');
	};

	env.glGetProgramInfoLog = function(program, maxLength, length, infoLog)
	{
		var log = GLctx.getProgramInfoLog(GLprograms[program]);
		if (log === null) log = '(unknown error)';
		if (maxLength > 0 && infoLog)
		{
			var numBytesWrittenExclNull = WriteHeapString(log, infoLog, maxLength);
			if (length) HEAP32[((length)>>2)]=numBytesWrittenExclNull;
		}
		else if (length) HEAP32[((length)>>2)]=0;
	};

	env.glGetProgramiv = function(program, pname, p)
	{
		if (!p)
		{
			// GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
			// if p == null, issue a GL error to notify user about it.
			GLrecordError(0x0501); // GL_INVALID_VALUE
			return;
		}

		if (program >= GLcounter)
		{
			GLrecordError(0x0501); // GL_INVALID_VALUE
			return;
		}

		var ptable = GLprogramInfos[program];
		if (!ptable)
		{
			GLrecordError(0x0502); //GL_INVALID_OPERATION
			return;
		}

		if (pname == 0x8B84) // GL_INFO_LOG_LENGTH
		{
			var log = GLctx.getProgramInfoLog(GLprograms[program]);
			if (log === null) log = '(unknown error)';
			HEAP32[((p)>>2)] = log.length + 1;
		}
		else if (pname == 0x8B87) //GL_ACTIVE_UNIFORM_MAX_LENGTH
		{
			HEAP32[((p)>>2)] = ptable.maxUniformLength;
		}
		else if (pname == 0x8B8A) //GL_ACTIVE_ATTRIBUTE_MAX_LENGTH
		{
			if (ptable.maxAttributeLength == -1)
			{
				program = GLprograms[program];
				var numAttribs = GLctx.getProgramParameter(program, GLctx.ACTIVE_ATTRIBUTES);
				ptable.maxAttributeLength = 0; // Spec says if there are no active attribs, 0 must be returned.
				for (var i = 0; i < numAttribs; ++i)
				{
					var activeAttrib = GLctx.getActiveAttrib(program, i);
					ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length+1);
				}
			}
			HEAP32[((p)>>2)] = ptable.maxAttributeLength;
		}
		else if (pname == 0x8A35) //GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH
		{
			if (ptable.maxUniformBlockNameLength == -1)
			{
				program = GLprograms[program];
				var numBlocks = GLctx.getProgramParameter(program, GLctx.ACTIVE_UNIFORM_BLOCKS);
				ptable.maxUniformBlockNameLength = 0;
				for (var i = 0; i < numBlocks; ++i)
				{
					var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
					ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length+1);
				}
			}
			HEAP32[((p)>>2)] = ptable.maxUniformBlockNameLength;
		}
		else
		{
			HEAP32[((p)>>2)] = GLctx.getProgramParameter(GLprograms[program], pname);
		}
	};

	env.glGetShaderInfoLog = function(shader, maxLength, length, infoLog)
	{
		var log = GLctx.getShaderInfoLog(GLshaders[shader]);
		if (log === null) log = '(unknown error)';
		if (maxLength > 0 && infoLog)
		{
			var numBytesWrittenExclNull = WriteHeapString(log, infoLog, maxLength);
			if (length) HEAP32[((length)>>2)] = numBytesWrittenExclNull;
		}
		else if (length) HEAP32[((length)>>2)] = 0;
	};

	env.glGetShaderiv = function(shader, pname, p)
	{
		if (!p)
		{
			// GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
			// if p == null, issue a GL error to notify user about it.
			GLrecordError(0x0501); // GL_INVALID_VALUE
			return;
		}
		if (pname == 0x8B84) // GL_INFO_LOG_LENGTH
		{
			var log = GLctx.getShaderInfoLog(GLshaders[shader]);
			if (log === null) log = '(unknown error)';
			HEAP32[((p)>>2)] = log.length + 1;
		}
		else if (pname == 0x8B88) // GL_SHADER_SOURCE_LENGTH
		{
			var source = GLctx.getShaderSource(GLshaders[shader]);
			var sourceLength = (source === null || source.length == 0) ? 0 : source.length + 1;
			HEAP32[((p)>>2)] = sourceLength;
		}
		else HEAP32[((p)>>2)] = GLctx.getShaderParameter(GLshaders[shader], pname);
	};

	env.glGetUniformLocation = function(program, name)
	{
		name = ReadHeapString(name);

		var arrayOffset = 0;
		if (name.indexOf(']', name.length-1) !== -1)
		{
			// If user passed an array accessor "[index]", parse the array index off the accessor.
			var ls = name.lastIndexOf('[');
			var arrayIndex = name.slice(ls+1, -1);
			if (arrayIndex.length > 0)
			{
				arrayOffset = parseInt(arrayIndex);
				if (arrayOffset < 0) return -1;
			}
			name = name.slice(0, ls);
		}

		var ptable = GLprogramInfos[program];
		if (!ptable) return -1;
		var utable = ptable.uniforms;
		var uniformInfo = utable[name]; // returns pair [ dimension_of_uniform_array, uniform_location ]
		if (uniformInfo && arrayOffset < uniformInfo[0])
		{
			// Check if user asked for an out-of-bounds element, i.e. for 'vec4 colors[3];' user could ask for 'colors[10]' which should return -1.
			return uniformInfo[1] + arrayOffset;
		}
		return -1;
	};

	env.glLineWidth = function(x0) { GLctx.lineWidth(x0); };

	env.glLinkProgram = function(program)
	{
		GLctx.linkProgram(GLprograms[program]);
		GLprogramInfos[program] = null; // uniforms no longer keep the same names after linking
		populateUniformTable(program);
	};

	env.glPixelStorei = function(pname, param)
	{
		if (pname == 0x0D05) GLpackAlignment = param; //GL_PACK_ALIGNMENT
		else if (pname == 0x0cf5) GLunpackAlignment = param; //GL_UNPACK_ALIGNMENT
		GLctx.pixelStorei(pname, param);
	};

	function webGLGetTexPixelData(type, format, width, height, pixels, internalFormat)
	{
		var sizePerPixel;
		var numChannels;
		switch(format)
		{
			case 0x1906: case 0x1909: case 0x1902: numChannels = 1; break; //GL_ALPHA, GL_LUMINANCE, GL_DEPTH_COMPONENT
			case 0x190A: numChannels = 2; break; //GL_LUMINANCE_ALPHA
			case 0x1907: case 0x8C40: numChannels = 3; break; //GL_RGB, GL_SRGB_EXT
			case 0x1908: case 0x8C42: numChannels = 4; break; //GL_RGBA, GL_SRGB_ALPHA_EXT
			default: GLrecordError(0x0500); return null; //GL_INVALID_ENUM
		}
		switch (type)
		{
			case 0x1401: sizePerPixel = numChannels*1; break; //GL_UNSIGNED_BYTE
			case 0x1403: case 0x8D61: sizePerPixel = numChannels*2; break; //GL_UNSIGNED_SHORT, GL_HALF_FLOAT_OES
			case 0x1405: case 0x1406: sizePerPixel = numChannels*4; break; //GL_UNSIGNED_INT, GL_FLOAT
			case 0x84FA: sizePerPixel = 4; break; //GL_UNSIGNED_INT_24_8_WEBGL/GL_UNSIGNED_INT_24_8
			case 0x8363: case 0x8033: case 0x8034: sizePerPixel = 2; break; //GL_UNSIGNED_SHORT_5_6_5, GL_UNSIGNED_SHORT_4_4_4_4, GL_UNSIGNED_SHORT_5_5_5_1
			default: GLrecordError(0x0500); return null; //GL_INVALID_ENUM
		}

		function roundedToNextMultipleOf(x, y) { return Math.floor((x + y - 1) / y) * y; }
		var plainRowSize = width * sizePerPixel;
		var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GLunpackAlignment);
		var bytes = (height <= 0 ? 0 : ((height - 1) * alignedRowSize + plainRowSize));

		switch(type)
		{
			case 0x1401: return HEAPU8.subarray((pixels),(pixels+bytes)); //GL_UNSIGNED_BYTE
			case 0x1406: return HEAPF32.subarray((pixels)>>2,(pixels+bytes)>>2); //GL_FLOAT
			case 0x1405: case 0x84FA: return HEAPU32.subarray((pixels)>>2,(pixels+bytes)>>2); //GL_UNSIGNED_INT, GL_UNSIGNED_INT_24_8_WEBGL/GL_UNSIGNED_INT_24_8
			case 0x1403: case 0x8363: case 0x8033: case 0x8034: case 0x8D61: return HEAPU16.subarray((pixels)>>1,(pixels+bytes)>>1); //GL_UNSIGNED_SHORT, GL_UNSIGNED_SHORT_5_6_5, GL_UNSIGNED_SHORT_4_4_4_4, GL_UNSIGNED_SHORT_5_5_5_1, GL_HALF_FLOAT_OES
			default: GLrecordError(0x0500); return null; //GL_INVALID_ENUM
		}
	}

	env.glReadPixels = function(x, y, width, height, format, type, pixels)
	{
		var pixelData = webGLGetTexPixelData(type, format, width, height, pixels, format);
		if (!pixelData) return GLrecordError(0x0500); // GL_INVALID_ENUM
		GLctx.readPixels(x, y, width, height, format, type, pixelData);
	};

	env.glScissor = function(x0, x1, x2, x3) { GLctx.scissor(x0, x1, x2, x3) };

	env.glShaderSource = function(shader, count, string, length)
	{
		var source = getSource(shader, count, string, length);
		GLctx.shaderSource(GLshaders[shader], source);
	};

	env.glTexImage2D = function(target, level, internalFormat, width, height, border, format, type, pixels)
	{
		var pixelData = null;
		if (pixels) pixelData = webGLGetTexPixelData(type, format, width, height, pixels, internalFormat);
		GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
	};

	env.glTexParameteri = function(x0, x1, x2)
	{
		GLctx.texParameteri(x0, x1, x2);
	};

	env.glTexSubImage2D = function(target, level, xoffset, yoffset, width, height, format, type, pixels)
	{
		var pixelData = null;
		if (pixels) pixelData = webGLGetTexPixelData(type, format, width, height, pixels, 0);
		GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
	};

	env.glUniform1f = function(loc, v0) { GLctx.uniform1f(GLuniforms[loc], v0); };
	env.glUniform1i = function(loc, v0) { GLctx.uniform1i(GLuniforms[loc], v0); };
	env.glUniform2f = function(loc, v0, v1) { GLctx.uniform2f(GLuniforms[loc], v0, v1); };
	env.glUniform3f = function(loc, v0, v1, v2) { GLctx.uniform3f(GLuniforms[loc], v0, v1, v2); };

	env.glUniform3fv = function(loc, count, value)
	{
		var view;
		if (3*count <= GLMINI_TEMP_BUFFER_SIZE)
		{
			// avoid allocation when uploading few enough uniforms
			view = GLminiTempBufferViews[3*count-1];
			for (var ptr = value>>2, i = 0; i != 3*count; i++)
			{
				view[i] = HEAPF32[ptr+i];
			}
		}
		else view = HEAPF32.subarray((value)>>2,(value+count*12)>>2);
		GLctx.uniform3fv(GLuniforms[loc], view);
	};

	env.glUniform4f = function(loc, v0, v1, v2, v3) { GLctx.uniform4f(GLuniforms[loc], v0, v1, v2, v3); };

	env.glUniformMatrix4fv = function(loc, count, transpose, value)
	{
		count<<=4;
		var view;
		if (count <= GLMINI_TEMP_BUFFER_SIZE)
		{
			// avoid allocation when uploading few enough uniforms
			view = GLminiTempBufferViews[count-1];
			for (var ptr = value>>2, i = 0; i != count; i += 4)
			{
				view[i  ] = HEAPF32[ptr+i  ];
				view[i+1] = HEAPF32[ptr+i+1];
				view[i+2] = HEAPF32[ptr+i+2];
				view[i+3] = HEAPF32[ptr+i+3];
			}
		}
		else view = HEAPF32.subarray((value)>>2,(value+count*4)>>2);
		GLctx.uniformMatrix4fv(GLuniforms[loc], !!transpose, view);
	};

	env.glUseProgram = function(program) { GLctx.useProgram(program ? GLprograms[program] : null); };
	env.glVertexAttrib4f = function(x0, x1, x2, x3, x4) { GLctx.vertexAttrib4f(x0, x1, x2, x3, x4); };
	env.glVertexAttrib4fv = function(index, v) { GLctx.vertexAttrib4f(index, HEAPF32[v>>2], HEAPF32[v+4>>2], HEAPF32[v+8>>2], HEAPF32[v+12>>2]); };
	env.glVertexAttribPointer = function(index, size, type, normalized, stride, ptr) { GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr); };
	env.glViewport = function(x0, x1, x2, x3) { GLctx.viewport(x0, x1, x2, x3); };
}

function WAJS_WASM_IMPORTS(env)
{
	var initTime;

	env.WAJS_SetupCanvas = function(width, height)
	{
		var cnvs = WA.canvas;
		cnvs.width = width;
		cnvs.height = height;
		cnvs.height = cnvs.clientHeight;
		cnvs.width = cnvs.clientWidth;

		if (!GLsetupContext(cnvs)) return;

		initTime = Date.now();

		var draw_func_ex = function() { if (ABORT) return; window.requestAnimationFrame(draw_func_ex); WA.asm.WAFNDraw(); };
		window.requestAnimationFrame(draw_func_ex);
	};

	env.WAJS_GetTime = function(type) { return Date.now() - initTime; };

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
}, wasi = {};
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

SYSCALLS_WASM_IMPORTS(env, wasi);
GL_WASM_IMPORTS(env);
WAJS_WASM_IMPORTS(env);

if (!WA.wasm) abort('BOOT', 'Missing Wasm data');
var wasmBytes = Base64Decode(WA.wasm);delete WA.wasm;

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

WebAssembly.instantiate(wasmBytes, {env:env,wasi_unstable:wasi,wasi_snapshot_preview1:wasi,wasi:wasi}).then(function (output)
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

})();
