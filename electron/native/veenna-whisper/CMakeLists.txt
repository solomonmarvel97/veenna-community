# Built by scripts/prepare-whisper.cjs, which passes WHISPER_CPP_DIR (the pinned source).
cmake_minimum_required(VERSION 3.16)
project(veenna_whisper C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# One self-contained binary: static libraries, the Metal shaders embedded.
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_SERVER OFF CACHE BOOL "" FORCE)
# Never tune for the build machine: a binary built on an M4 must still run on an M1.
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
# Accelerate's BLAS needs macOS 13.3; Metal does the heavy work, so leave it out.
set(GGML_BLAS OFF CACHE BOOL "" FORCE)
if(APPLE)
  set(GGML_METAL ON CACHE BOOL "" FORCE)
  set(GGML_METAL_EMBED_LIBRARY ON CACHE BOOL "" FORCE)
endif()

if(NOT WHISPER_CPP_DIR)
  message(FATAL_ERROR "WHISPER_CPP_DIR is not set")
endif()
add_subdirectory(${WHISPER_CPP_DIR} whisper.cpp EXCLUDE_FROM_ALL)

add_executable(veenna-whisper main.cpp)
target_link_libraries(veenna-whisper PRIVATE whisper)
