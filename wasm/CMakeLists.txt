# NAM wasm engine
#
# A single-threaded, multi-instance wasm module with no Web Audio or threading
# scaffolding. It is instantiated exactly once inside a hand-written JS
# AudioWorkletProcessor (ui/src/engine/nam-worklet.ts), which passes the wasm
# bytes in directly (no fetch in the worklet scope).
#
# This deliberately avoids Emscripten's -sAUDIO_WORKLET / -sWASM_WORKERS /
# pthreads / SharedArrayBuffer machinery: instantiating the module a second
# time on the audio worklet thread triggered a ~500 MB wasm recompile storm in
# WebKit that crossed the iOS Jetsam limit at play time (tab crash).

file(GLOB_RECURSE NAM_SOURCES ../NAM/*.cpp)

add_executable(nam-engine nam-engine.cpp ${NAM_SOURCES})

target_include_directories(nam-engine PRIVATE
	..
	${NAM_DEPS_PATH}/eigen
	${NAM_DEPS_PATH}/nlohmann
)

target_compile_definitions(nam-engine PRIVATE
	# Web Audio processes 32-bit floats
	NAM_SAMPLE_FLOAT
	# Never let Eigen allocate on the (small) wasm stack
	EIGEN_STACK_ALLOCATION_LIMIT=0
	# Inline GEMM optimizations from NAM core
	NAM_USE_INLINE_GEMM
)

target_compile_features(nam-engine PUBLIC cxx_std_20)

set_target_properties(nam-engine PROPERTIES
	CXX_VISIBILITY_PRESET hidden
	PREFIX ""
)

# -fwasm-exceptions: native wasm exception handling (Safari >= 15.2), so a bad
# model file fails nam_loadModel() cleanly instead of aborting the module that
# every player shares. Near-zero cost on the audio path.
target_compile_options(nam-engine PRIVATE -Os -msimd128 -fwasm-exceptions)

target_link_options(nam-engine PRIVATE
	-Os
	-fwasm-exceptions
	--no-entry
	# ES module factory: `import createNamEngine from './nam-engine.js'`
	-sMODULARIZE=1
	-sEXPORT_ES6=1
	-sEXPORT_NAME=createNamEngine
	# node is kept for CI smoke tests. The AudioWorkletGlobalScope matches none
	# of these environments; that is fine because the worklet passes wasmBinary
	# in, so the glue never needs fetch/importScripts/fs there.
	-sENVIRONMENT=web,worker,node
	# Small non-shared heap that grows on demand. This is the whole point of
	# the architecture: 64 MB up front instead of 512 MB, and no
	# SharedArrayBuffer (no COOP/COEP requirement).
	-sALLOW_MEMORY_GROWTH=1
	-sINITIAL_MEMORY=64MB
	-sMAXIMUM_MEMORY=512MB
	# Model JSON parsing is the deepest stack user (Eigen never stack-allocates
	# here, see EIGEN_STACK_ALLOCATION_LIMIT). Lives inside linear memory.
	-sSTACK_SIZE=4MB
	# Module properties the JS layer passes in; emscripten only honors the ones
	# declared here (the worklet passes wasmBinary because its scope has no
	# fetch)
	-sINCOMING_MODULE_JS_API=wasmBinary,locateFile,instantiateWasm,onRuntimeInitialized,print,printErr
	# nam_* exports are annotated with EMSCRIPTEN_KEEPALIVE in nam-engine.cpp
	-sEXPORTED_FUNCTIONS=_malloc,_free
	-sEXPORTED_RUNTIME_METHODS=stringToUTF8,lengthBytesUTF8,UTF8ToString,HEAPF32,HEAPU8
	# No filesystem access (models arrive as JSON strings); shrinks the glue
	-sFILESYSTEM=0
	# No eval() in the glue (CSP-friendly)
	-sDYNAMIC_EXECUTION=0
)
