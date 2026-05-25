cmake_minimum_required(VERSION 3.16)

project(SpriteForgeCpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MINGW)
  add_compile_options(-finput-charset=UTF-8 -fexec-charset=UTF-8)
endif()

add_executable(spriteforge_cpp
  src_cpp/core.cpp
  src_cpp/server.cpp
)

target_include_directories(spriteforge_cpp PRIVATE src_cpp)

if(WIN32)
  target_link_libraries(spriteforge_cpp PRIVATE ws2_32)
endif()

add_executable(spriteforge_cli
  src_cpp/core.cpp
  src_cpp/cli.cpp
)

target_include_directories(spriteforge_cli PRIVATE src_cpp)
