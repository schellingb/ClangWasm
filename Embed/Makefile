#
# This is free and unencumbered software released into the public domain.
#
# Anyone is free to copy, modify, publish, use, compile, sell, or
# distribute this software, either in source code form or as a compiled
# binary, for any purpose, commercial or non-commercial, and by any
# means.
#
# In jurisdictions that recognize copyright laws, the author or authors
# of this software dedicate any and all copyright interest in the
# software to the public domain. We make this dedication for the benefit
# of the public at large and to the detriment of our heirs and
# successors. We intend this dedication to be an overt act of
# relinquishment in perpetuity of all present and future rights to this
# software under copyright law.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
# EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
# OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
# ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
# OTHER DEALINGS IN THE SOFTWARE.
#
# For more information, please refer to <http://unlicense.org/>
#

LLVM_ROOT   = D:/dev/wasm/llvm
SYSTEM_ROOT = D:/dev/wasm/system
WASMOPT     = D:/dev/wasm/wasm-opt.exe
PYTHON      = D:/dev/python/python.exe

PROJECT = test
SOURCES = main.cpp
EXPORTS = WAFNDraw WAFNAudio
BUILD   = RELEASE

#------------------------------------------------------------------------------------------------------

SPACE := $(strip ) $(strip )
THIS_MAKEFILE := $(patsubst ./%,%,$(subst \,/,$(lastword $(MAKEFILE_LIST))))
ISWIN := $(findstring :,$(firstword $(subst \, ,$(subst /, ,$(abspath .)))))

ifeq ($(BUILD),RELEASE)
  SYSOUTDIR := $(dir $(THIS_MAKEFILE))system
  OUTDIR    := Release-wasm
  DBGCFLAGS := -DNDEBUG
  LDFLAGS   := -strip-all -gc-sections
  WOPTFLAGS := -O3
  LOADERJS  := $(dir $(THIS_MAKEFILE))loader.minified.js
else
  SYSOUTDIR := $(dir $(THIS_MAKEFILE))system
  OUTDIR    := Debug-wasm
  DBGCFLAGS := -DDEBUG -D_DEBUG
  LDFLAGS   :=
  WOPTFLAGS := -g -O0
  LOADERJS  := $(dir $(THIS_MAKEFILE))loader.js
endif

# Global compiler flags
CXXFLAGS := $(DBGCFLAGS) -Ofast -std=c++11 -fno-rtti -Wno-writable-strings -Wno-unknown-pragmas
CCFLAGS  := $(DBGCFLAGS) -Ofast -std=c99

# Global compiler flags for Wasm targeting
CLANGFLAGS := -target wasm32 -nostdinc
CLANGFLAGS += -D__EMSCRIPTEN__ -D_LIBCPP_ABI_VERSION=2
CLANGFLAGS += -fvisibility=hidden -fno-builtin -fno-exceptions -fno-threadsafe-statics
CLANGFLAGS += -isystem$(SYSTEM_ROOT)/include/libcxx
CLANGFLAGS += -isystem$(SYSTEM_ROOT)/include/compat
CLANGFLAGS += -isystem$(SYSTEM_ROOT)/include
CLANGFLAGS += -isystem$(SYSTEM_ROOT)/include/libc
CLANGFLAGS += -isystem$(SYSTEM_ROOT)/lib/libc/musl/arch/emscripten

# Flags for wasm-ld
LDFLAGS += -no-entry -allow-undefined -import-memory
LDFLAGS += -export=__wasm_call_ctors -export=malloc -export=free -export=main
LDFLAGS += $(addprefix -export=,$(patsubst _%,%,$(strip $(EXPORTS))))

# Project Build flags, add defines from the make command line (e.g. D=MACRO=VALUE)
FLAGS := $(subst \\\, ,$(foreach F,$(subst \ ,\\\,$(D)),"-D$(F)"))

# Check if there are any source files
ifeq ($(SOURCES),)
  $(error No source files found for build)
endif

# Compute tool paths
ifeq ($(wildcard $(subst $(SPACE),\ ,$(LLVM_ROOT))/clang*),)
  $(error clang executables not found in set LLVM_ROOT path ($(LLVM_ROOT)). Set custom path in $(THIS_MAKEFILE) with LLVM_ROOT = $(if $(ISWIN),d:)/path/to/clang)
endif
ifeq ($(wildcard $(subst $(SPACE),\ ,$(WASMOPT))),)
  $(error wasm-opt executable not found in set WASMOPT path ($(WASMOPT)). Fix path in $(THIS_MAKEFILE) with WASMOPT = $(if $(ISWIN),d:)/path/to/wasm-opt$(if $(ISWIN),.exe))
endif
PYTHON_FIND := $(if $(PYTHON),$(wildcard $(PYTHON)),$(if $(shell python -c "print 1" 2>$(if $(ISWIN),nul,/dev/null)),python))
ifeq ($(PYTHON_FIND),)
  $(error Python executable not found in PATH and not correctly set with PYTHON setting ($(PYTHON)). Set custom path in $(THIS_MAKEFILE) with PYTHON = $(if $(ISWIN),d:)/path/to/python/python$(if $(ISWIN),.exe))
endif

# Surround used commands with double quotes
CC      := "$(LLVM_ROOT)/clang"
CXX     := "$(LLVM_ROOT)/clang" -x c++
LD      := "$(LLVM_ROOT)/wasm-ld"
WASMOPT := "$(WASMOPT)"
PYTHON  := "$(PYTHON_FIND)"

# Python one liner to delete multiple files with existance check and no stdout output
CMD_DEL_FILES := $(PYTHON) -c "import sys,os;[os.path.exists(a) and os.remove(a) for a in sys.argv[1:]]"

# Python one liner generate an output loader js file with base64 encoded wasm file appended to the top
CMD_MAKE_JS   := $(PYTHON) -c "import sys,os,base64;b=open(sys.argv[3],'rb').read();open(sys.argv[1],'w').write('WA.wasm='+chr(39)+(base64.b64encode(b) if sys.version_info[0]<3 else base64.b64encode(b).decode('ascii'))+chr(39)+';'+chr(10)+open(sys.argv[2],'r').read())"

# Python one liner to gzip a file
CMD_MAKE_GZ   := $(PYTHON) -c "import sys,gzip;gzip.GzipFile('','wb',9,open(sys.argv[1],'wb'),0).write(open(sys.argv[2],'rb').read())"

# Python one liner to generate an output loader html file from the template with tags replaced
CMD_MAKE_HTML := $(PYTHON) -c "import sys;open(sys.argv[1],'w').write(open(sys.argv[2],'r').read().replace('{{PROJECT}}','$(PROJECT)').replace('{{SCRIPT}}','<script src='+chr(34)+'$(PROJECT).js'+chr(34)+' type='+chr(34)+'text/javascript'+chr(34)+'></script>'))"

all: $(OUTDIR)/$(PROJECT).js$(if $(filter RELEASE,$(BUILD)),.gz) $(OUTDIR)/$(PROJECT).html #analyze #run
.PHONY: clean cleanall run analyze

clean:
	$(info Removing all build files ...)
	@$(CMD_DEL_FILES) $(OBJS) $(OBJS:%.o=%.d) $(OUTDIR)/$(PROJECT).wasm $(OUTDIR)/$(PROJECT).js $(OUTDIR)/$(PROJECT).js.gz \

# Generate a list of .o files to build, include dependency rules for source files, then compile files
OBJS := $(addprefix $(OUTDIR)/,$(notdir $(patsubst %.c,%.o,$(patsubst %.cpp,%.o,$(SOURCES)))))
-include $(OBJS:%.o=%.d)
MAKEOBJ = $(OUTDIR)/$(basename $(notdir $(1))).o: $(1) ; $$(call COMPILE,$$@,$$<,$(2),$(3) $$(FLAGS))
$(foreach F,$(filter %.cpp,$(SOURCES)),$(eval $(call MAKEOBJ,$(F),$$(CXX),$$(CXXFLAGS))))
$(foreach F,$(filter %.c  ,$(SOURCES)),$(eval $(call MAKEOBJ,$(F),$$(CC),$$(CCFLAGS))))

$(OUTDIR)/$(PROJECT).wasm : $(THIS_MAKEFILE) $(OBJS) $(SYSOUTDIR)/System.bc
	$(info Linking $@ ...)
	@$(LD) $(LDFLAGS) -o $@ $(OBJS) $(SYSOUTDIR)/System.bc
	@$(WASMOPT) --legalize-js-interface $(WOPTFLAGS) $@ -o $@

$(OUTDIR)/$(PROJECT).js : $(LOADERJS) $(OUTDIR)/$(PROJECT).wasm
	$(info Generating $@ from $^ ...)
	@$(CMD_MAKE_JS) $@ $^

$(OUTDIR)/%.js.gz : $(OUTDIR)/%.js
	$(info Compressing $^ to $@ ...)
	@$(if $(wildcard $@),$(if $(ISWIN),del "$(subst /,\,$@)" ,rm "$@" >/dev/null),)
	@$(CMD_MAKE_GZ) $@ $^

$(OUTDIR)/$(PROJECT).html : $(dir $(THIS_MAKEFILE))loader.html
	$(info $(if $(wildcard $@),Warning: Template $^ is newer than $@ - delete the local build file to have it regenerated,Generating $@ ...))
	@$(if $(wildcard $@),,$(CMD_MAKE_HTML) "$@" "$^")

run : $(OUTDIR)/$(PROJECT).js $(OUTDIR)/$(PROJECT).html
	$(if $(wildcard $(BROWSER)),,$(error browser not found in set BROWSER path ($(BROWSER)). Set custom path in $(THIS_MAKEFILE) with BROWSER = $(if $(ISWIN),c:)/path/to/browser$(if $(ISWIN),.exe)))
	$(info Running browser '$(BROWSER)' with output '$(OUTDIR)/$(PROJECT).html' ...)
	@$(BROWSER) "$(OUTDIR)/$(PROJECT).html"

analyze : $(OUTDIR)/$(PROJECT).wasm
	$(if $(wildcard $(WABT_ROOT)/wasm-objdump*),,$(error WebAssembly Binary Toolkit not found in set WABT_ROOT path ($(WABT_ROOT)). Set custom path in $(THIS_MAKEFILE) with WABT_ROOT = $(if $(ISWIN),c:)/path/to/wabt))
	$(info Creating $^.objdump, $^.decompile and $^.c)
	$(WABT_ROOT)/wasm-objdump -xd $^ >$^.objdump
	$(WABT_ROOT)/wasm-decompile $^ -o $^.decompile
	$(WABT_ROOT)/wasm2c $^ -o $^.c

define COMPILE
	$(info $2)
	@$(if $(wildcard $(dir $1)),,$(shell mkdir "$(dir $1)"))
	@$3 $4 $(CLANGFLAGS) -MMD -MP -MF $(patsubst %.o,%.d,$1) -o $1 -c $2
endef

#------------------------------------------------------------------------------------------------------
#if System.bc exists, don't even bother checking sources, build once and forget for now
ifeq ($(if $(wildcard $(SYSOUTDIR)/System.bc),1,0),0)
SYS_ADDS := emmalloc.cpp libcxx/*.cpp libcxxabi/src/cxa_guard.cpp compiler-rt/lib/builtins/*.c libc/wasi-helpers.c
SYS_MUSL := complex crypt ctype dirent errno fcntl fenv internal locale math misc mman multibyte prng regex select stat stdio stdlib string termios unistd

# C++ streams and locale are not included on purpose because it can increase the output up to 500kb
SYS_IGNORE := iostream.cpp strstream.cpp locale.cpp thread.cpp exception.cpp
SYS_IGNORE += abs.c acos.c acosf.c acosl.c asin.c asinf.c asinl.c atan.c atan2.c atan2f.c atan2l.c atanf.c atanl.c ceil.c ceilf.c ceill.c cos.c cosf.c cosl.c exp.c expf.c expl.c 
SYS_IGNORE += fabs.c fabsf.c fabsl.c floor.c floorf.c floorl.c log.c logf.c logl.c pow.c powf.c powl.c rintf.c round.c roundf.c sin.c sinf.c sinl.c sqrt.c sqrtf.c sqrtl.c tan.c tanf.c tanl.c
SYS_IGNORE += syscall.c wordexp.c initgroups.c getgrouplist.c popen.c _exit.c alarm.c usleep.c faccessat.c iconv.c

SYS_SOURCES := $(filter-out $(SYS_IGNORE:%=\%/%),$(wildcard $(addprefix $(SYSTEM_ROOT)/lib/,$(SYS_ADDS) $(SYS_MUSL:%=libc/musl/src/%/*.c))))
SYS_SOURCES := $(subst $(SYSTEM_ROOT)/lib/,,$(SYS_SOURCES))

ifeq ($(findstring !,$(SYS_SOURCES)),!)
  $(error SYS_SOURCES contains a filename with a ! character in it - Unable to continue)
endif

SYS_MISSING := $(filter-out $(SYS_SOURCES) $(dir $(SYS_SOURCES)),$(subst *.c,,$(subst *.cpp,,$(SYS_ADDS))) $(SYS_MUSL:%=libc/musl/src/%/))
ifeq ($(if $(SYS_MISSING),1,0),1)
  $(error SYS_SOURCES missing the following files in $(SYSTEM_ROOT)/lib: $(SYS_MISSING))
endif

SYS_OLDFILES := $(filter-out $(subst /,!,$(patsubst %.c,%.o,$(patsubst %.cpp,%.o,$(SYS_SOURCES)))),$(notdir $(wildcard $(SYSOUTDIR)/temp/*.o)))
ifeq ($(if $(SYS_OLDFILES),1,0),1)
  $(shell $(CMD_DEL_FILES) $(addprefix $(SYSOUTDIR)/temp/,$(SYS_OLDFILES)) $(SYSOUTDIR)/System.bc)
endif

SYS_CXXFLAGS := -Ofast -std=c++11 -fno-threadsafe-statics -fno-rtti -I$(SYSTEM_ROOT)/lib/libcxxabi/include
SYS_CXXFLAGS += -DNDEBUG -D_LIBCPP_BUILDING_LIBRARY -D_LIBCPP_DISABLE_VISIBILITY_ANNOTATIONS

SYS_CCFLAGS := -Ofast -std=gnu99 -fno-threadsafe-statics
SYS_CCFLAGS += -DNDEBUG -Dunix -D__unix -D__unix__
SYS_CCFLAGS += -isystem$(SYSTEM_ROOT)/lib/libc/musl/src/internal
SYS_CCFLAGS += -Wno-dangling-else -Wno-ignored-attributes -Wno-bitwise-op-parentheses -Wno-logical-op-parentheses -Wno-shift-op-parentheses -Wno-string-plus-int
SYS_CCFLAGS += -Wno-unknown-pragmas -Wno-shift-count-overflow -Wno-return-type -Wno-macro-redefined -Wno-unused-result -Wno-pointer-sign

SYS_CPP_OBJS := $(addprefix $(SYSOUTDIR)/temp/,$(subst /,!,$(patsubst %.cpp,%.o,$(filter %.cpp,$(SYS_SOURCES)))))
SYS_CC_OBJS  := $(addprefix $(SYSOUTDIR)/temp/,$(subst /,!,$(patsubst   %.c,%.o,$(filter   %.c,$(SYS_SOURCES)))))
$(SYS_CPP_OBJS) : ; $(call SYS_COMPILE,$@,$(subst !,/,$(patsubst $(SYSOUTDIR)/temp/%.o,$(SYSTEM_ROOT)/lib/%.cpp,$@)),$(CXX),$(SYS_CXXFLAGS))
$(SYS_CC_OBJS)  : ; $(call SYS_COMPILE,$@,$(subst !,/,$(patsubst $(SYSOUTDIR)/temp/%.o,$(SYSTEM_ROOT)/lib/%.c,$@)),$(CC),$(SYS_CCFLAGS))

define SYS_COMPILE
	$(info $2)
	@$(if $(wildcard $(dir $1)),,$(shell mkdir "$(dir $1)"))
	@$3 $4 $(CLANGFLAGS) -o $1 -c $2
endef

$(SYSOUTDIR)/System.bc : $(SYS_CPP_OBJS) $(SYS_CC_OBJS)
	$(info Creating archive $@ ...)
	@$(LD) $(if $(ISWIN),"$(SYSOUTDIR)/temp/*.o",$(SYSOUTDIR)/temp/*.o) -r -o $@
	@$(if $(ISWIN),rmdir /S /Q,rm -rf) "$(SYSOUTDIR)/temp"
endif #need System.bc
#------------------------------------------------------------------------------------------------------
