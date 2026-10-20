cmake_minimum_required(VERSION 3.20)
project(fixture C)

include(cmake/helpers.cmake)

greet(world)
add_executable(app main.c)
target_compile_definitions(app PRIVATE GREETING="${GREETING}")
