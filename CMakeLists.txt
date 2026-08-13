cmake_minimum_required(VERSION 3.10)

project(NAM_WASM)

# This repo builds only the wasm engine (wasm/) against the NeuralAmpModelerCore
# submodule (core/). For native tools, tests, and benchmarks, build the
# submodule directly with its own CMakeLists.
if (NOT DEFINED EMSCRIPTEN AND NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
	message(FATAL_ERROR "This project only supports Emscripten builds; use ./wasm/build.bash (emcmake).")
endif()

if (NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/core/NAM/dsp.h")
	message(FATAL_ERROR "core/ submodule is missing; run: git submodule update --init --recursive")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED OFF)
set(CMAKE_CXX_EXTENSIONS OFF)

set(NAM_DEPS_PATH "${CMAKE_CURRENT_SOURCE_DIR}/core/Dependencies")

# Build the specialized A2 fast-path WaveNet (A2 standard + A2 nano). When ON,
# models whose config matches the A2 shape signature are routed to a hand-optimized
# WaveNet implementation instead of the generic one. When OFF, all models go
# through the generic path.
option(NAM_ENABLE_A2_FAST "Build the A2 fast-path WaveNet" ON)
if(NAM_ENABLE_A2_FAST)
	add_compile_definitions(NAM_ENABLE_A2_FAST)
endif()

add_subdirectory(wasm)
