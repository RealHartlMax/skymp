cmake_minimum_required(VERSION 3.24)
cmake_policy(SET CMP0091 NEW)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
project(SkyMPAddressLibraryProbe LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "The native address library probe requires Windows")
endif()

find_package(spdlog CONFIG REQUIRED)
find_package(directxtk CONFIG REQUIRED)
find_package(CommonLibSSE CONFIG REQUIRED)

add_executable(address-library-probe main.cpp)
target_compile_features(address-library-probe PRIVATE cxx_std_23)
target_compile_definitions(address-library-probe PRIVATE ENABLE_COMMONLIBSSE_TESTING=1)
target_link_libraries(address-library-probe PRIVATE CommonLibSSE::CommonLibSSE)
