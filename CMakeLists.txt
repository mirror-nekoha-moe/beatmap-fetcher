cmake_minimum_required(VERSION 3.15)

# enter your project name/application output name
project(beatmap-fetcher LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20) #cpp version
set(CMAKE_CXX_SCAN_FOR_MODULES ON)

# Base directories
set(BASE_INCLUDE_PATH "${CMAKE_SOURCE_DIR}/src/includes")
set(BASE_LIB_PATH "${CMAKE_SOURCE_DIR}/src/libs")

# STATIC LIB, you are a stupid fuck if u dont
option(USE_STATIC_LIB "Use static library" ON)

# Debug/Release-specific paths
#[===[
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    #set(BUILD_INCLUDE_PATH "${CMAKE_SOURCE_DIR}/cmake-template-project/includes/Debug/")
    #set(BUILD_LIB_PATH "${CMAKE_SOURCE_DIR}/src/libs/LIB_Debug/")
elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
    #set(BUILD_INCLUDE_PATH "${CMAKE_SOURCE_DIR}/cmake-template-project/includes/Release/")
    #set(BUILD_LIB_PATH "${CMAKE_SOURCE_DIR}/src/libs/LIB_Release/")
endif()
]===]

# Add the include directories for the project
include_directories(${BASE_INCLUDE_PATH} ${BUILD_INCLUDE_PATH})

# Add the library directories for linking
link_directories(${BASE_LIB_PATH} ${BUILD_LIB_PATH})

# Project-specific CMakeLists.txt
add_executable(${PROJECT_NAME} "./src/main.cpp")