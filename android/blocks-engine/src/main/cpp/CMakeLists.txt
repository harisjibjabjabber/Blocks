cmake_minimum_required(VERSION 3.22.1)
project(blocksengine)

set(BLOCKS_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../..)
set(OBOE_DIR ${BLOCKS_ROOT}/third_party/oboe)

add_subdirectory(${OBOE_DIR} ${CMAKE_CURRENT_BINARY_DIR}/oboe)

add_library(blocksengine SHARED
    ${BLOCKS_ROOT}/native/src/midi_parser.cpp
    ${BLOCKS_ROOT}/native/src/instrument.cpp
    ${BLOCKS_ROOT}/native/src/pipeline.cpp
    ${BLOCKS_ROOT}/native/src/render.cpp
    ${BLOCKS_ROOT}/native/src/oboe_engine.cpp
    ${BLOCKS_ROOT}/native/src/jni_bridge.cpp
)

target_include_directories(blocksengine PRIVATE ${BLOCKS_ROOT}/native/include)
target_compile_features(blocksengine PRIVATE cxx_std_20)
target_link_libraries(blocksengine oboe android log)
