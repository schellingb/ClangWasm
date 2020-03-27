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
WASMOPT     = D:/dev/wasm/wasm-opt.exe

EXPORTS = square
SOURCES = main.c
BUILD   = RELEASE

#------------------------------------------------------------------------------------------------------

ifeq ($(BUILD),RELEASE)
  OUTDIR    := Release-wasm
  DBGCFLAGS := -DNDEBUG
  LDFLAGS   := -strip-all -gc-sections
  WOPTFLAGS := -O3
else
  OUTDIR    := Debug-wasm
  DBGCFLAGS := -DDEBUG -D_DEBUG
  LDFLAGS   :=
  WOPTFLAGS := -g -O0
endif

# Global compiler flags
CXXFLAGS := $(DBGCFLAGS) -Ofast -std=c++11 -fno-rtti -Wno-writable-strings -Wno-unknown-pragmas
CCFLAGS  := $(DBGCFLAGS) -Ofast -std=c99

# Global compiler flags for Wasm targeting
CLANGFLAGS := -target wasm32 -nostdinc
CLANGFLAGS += -D__EMSCRIPTEN__ -D_LIBCPP_ABI_VERSION=2
CLANGFLAGS += -fvisibility=hidden -fno-builtin -fno-exceptions -fno-threadsafe-statics

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
ISWIN := $(findstring :,$(firstword $(subst \, ,$(subst /, ,$(abspath .)))))
PIPETONULL := $(if $(ISWIN),>nul 2>nul,>/dev/null 2>/dev/null)
ifeq ($(wildcard $(subst $(strip ) ,\ ,$(LLVM_ROOT))/clang*),)
  $(error clang executables not found in set LLVM_ROOT path ($(LLVM_ROOT)). Set custom path in this makefile with LLVM_ROOT = $(if $(ISWIN),d:)/path/to/clang)
endif
ifeq ($(wildcard $(subst $(strip ) ,\ ,$(WASMOPT))),)
  $(error wasm-opt executable not found in set WASMOPT path ($(WASMOPT)). Fix path in this makefile with WASMOPT = $(if $(ISWIN),d:)/path/to/wasm-opt$(if $(ISWIN),.exe))
endif

# Surround used commands with double quotes
CC  := "$(LLVM_ROOT)/clang"
CXX := "$(LLVM_ROOT)/clang" -x c++
LD  := "$(LLVM_ROOT)/wasm-ld"

all: $(OUTDIR)/loader.js $(OUTDIR)/loader.html $(OUTDIR)/output.wasm
.PHONY: clean cleanall run analyze

clean:
	$(info Removing all build files ...)
	@$(if $(wildcard $(OUTDIR)),$(if $(ISWIN),rmdir /S /Q,rm -rf) "$(OUTDIR)" $(PIPETONULL))

# Generate a list of .o files to build, include dependency rules for source files, then compile files
OBJS := $(addprefix $(OUTDIR)/,$(notdir $(patsubst %.c,%.o,$(patsubst %.cpp,%.o,$(SOURCES)))))
-include $(OBJS:%.o=%.d)
MAKEOBJ = $(OUTDIR)/$(basename $(notdir $(1))).o: $(1) ; $$(call COMPILE,$$@,$$<,$(2),$(3) $$(FLAGS))
$(foreach F,$(filter %.cpp,$(SOURCES)),$(eval $(call MAKEOBJ,$(F),$$(CXX),$$(CXXFLAGS))))
$(foreach F,$(filter %.c  ,$(SOURCES)),$(eval $(call MAKEOBJ,$(F),$$(CC),$$(CCFLAGS))))

$(OUTDIR)/output.wasm : Makefile $(OBJS)
	$(info Linking $@ ...)
	@$(LD) $(LDFLAGS) -o $@ $(OBJS)
	@"$(WASMOPT)" --legalize-js-interface $(WOPTFLAGS) $@ -o $@

$(OUTDIR)/loader.js : loader.js
	$(info Copying $^ to $@ ...)
	@$(if $(wildcard $(OUTDIR)),,$(shell mkdir "$(OUTDIR)"))
	@$(if $(ISWIN),copy,cp) "$^" "$@" $(PIPETONULL)

$(OUTDIR)/loader.html : loader.html
	$(if $(wildcard $(OUTDIR)),,$(shell mkdir "$(OUTDIR)"))
	@$(if $(ISWIN),copy,cp) "$^" "$@" $(PIPETONULL)

define COMPILE
	$(info $2)
	@$(if $(wildcard $(dir $1)),,$(shell mkdir "$(dir $1)"))
	@$3 $4 $(CLANGFLAGS) -MMD -MP -MF $(patsubst %.o,%.d,$1) -o $1 -c $2
endef
