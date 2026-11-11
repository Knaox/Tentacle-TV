# Module pont : `window.tentacle` compatible avec le front de Tentacle.
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/bridge)`), ou construit SEUL
# tant que le socle n'est pas intégré (logique + tests, sans CEF ni libmpv) :
#   cmake -S src/bridge -B ~/.cache/tentacle-cef/build/pont -G Ninja && ninja -C … -j4 && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_bridge LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()

find_package(nlohmann_json 3.11 REQUIRED)

# Le shim JS est embarqué dans le binaire (comme la référence : `embed_all_resources.cmake`,
# puis `include_str!`) : rien à chercher sur le disque au lancement, et la version du
# script est celle du binaire. Reconfiguré quand le .js change.
set(TENTACLE_SHIM_JS "${CMAKE_CURRENT_SOURCE_DIR}/../../web/shim/tentacle-bridge.js")
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${TENTACLE_SHIM_JS}")
file(READ "${TENTACLE_SHIM_JS}" TENTACLE_SHIM_SOURCE)
string(FIND "${TENTACLE_SHIM_SOURCE}" ")tentacleshim\"" _delimiter_clash)
if(NOT _delimiter_clash EQUAL -1)
  message(FATAL_ERROR "tentacle-bridge.js contient le délimiteur de chaîne brute")
endif()
configure_file(shim_source.cpp.in "${CMAKE_CURRENT_BINARY_DIR}/shim_source.cpp" @ONLY)

add_library(tentacle_bridge STATIC
  registry.cpp
  mpv_policy.cpp
  mpv_fault.cpp
  video_channels.cpp
  video_prewarm.cpp
  window_channels.cpp
  video_probe.cpp
  "${CMAKE_CURRENT_BINARY_DIR}/shim_source.cpp"
)
target_include_directories(tentacle_bridge PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(tentacle_bridge PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_bridge PUBLIC cxx_std_20)

add_executable(tentacle_bridge_tests tests/bridge_tests.cpp tests/fakes.h)
target_link_libraries(tentacle_bridge_tests PRIVATE tentacle_bridge)
add_test(NAME tentacle_bridge_tests COMMAND tentacle_bridge_tests)
add_executable(tentacle_prewarm_tests tests/prewarm_tests.cpp tests/fakes.h)
target_link_libraries(tentacle_prewarm_tests PRIVATE tentacle_bridge)
add_test(NAME tentacle_prewarm_tests COMMAND tentacle_prewarm_tests)

# La colle avec le proto (IPC du socle, fenêtre SDL3, compositeur, lecteur de vidéo-HDR) :
# seulement quand ces cibles existent — le module reste constructible seul pour ses tests.
if(TARGET tentacle_shell AND TARGET tentacle_player)
  add_library(tentacle_bridge_glue STATIC glue/pont_shell.cpp glue/mpv_player_port.cpp)
  target_link_libraries(tentacle_bridge_glue PUBLIC tentacle_bridge tentacle_shell tentacle_player)
  target_compile_options(tentacle_bridge_glue PRIVATE -Wall -Wextra -Wno-unused-parameter)
  # La sonde de surface (video_surface_probe, video_edr_probe) : macOS, build de développement.
  if(APPLE AND NOT TENTACLE_DIST)
    target_sources(tentacle_bridge_glue PRIVATE glue/video_probe_glue.cpp
                   "${CMAKE_CURRENT_SOURCE_DIR}/../platform/macos/video_probe_mac.mm")
    target_compile_definitions(tentacle_bridge_glue PRIVATE TENTACLE_VIDEO_PROBES=1)
    target_compile_options(tentacle_bridge_glue PRIVATE $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  endif()
endif()
if(TARGET tentacle_bridge_glue)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens,
  # que CMake résout pour des bibliothèques statiques.
  target_link_libraries(tentacle_shell PUBLIC tentacle_bridge_glue)
endif()
