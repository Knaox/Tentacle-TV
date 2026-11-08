# Banc H1 vidéo-HDR (sans CEF) : SDL3 + VideoSurface macOS + libmpv (fork + contexte moltenvk).
# Construisible seul :
#   cmake -S bench/hdr -B ~/.cache/tentacle-cef/build/video-hdr/bench -G Ninja
#   ninja -C ~/.cache/tentacle-cef/build/video-hdr/bench -j4
# libmpv : MPV_PREFIX (défaut $TENTACLE_CEF_CACHE/deps/mpv/b5c712f4).
cmake_minimum_required(VERSION 3.24)
project(hdr_bench LANGUAGES C CXX OBJCXX)

if(NOT DEFINED MPV_PREFIX)
  if(DEFINED ENV{TENTACLE_CEF_CACHE})
    set(MPV_PREFIX "$ENV{TENTACLE_CEF_CACHE}/deps/mpv/b5c712f4")
  else()
    set(MPV_PREFIX "$ENV{HOME}/.cache/tentacle-cef/deps/mpv/b5c712f4")
  endif()
endif()
find_package(SDL3 REQUIRED CONFIG)
find_package(nlohmann_json 3.11 REQUIRED CONFIG)

set(REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../..")
add_subdirectory("${REPO_ROOT}/src/player" "${CMAKE_CURRENT_BINARY_DIR}/player")

# Bundles .app : lancés par `open` (LaunchServices), la fenêtre est une vraie fenêtre d'app.
foreach(bench hdr-bench player-bench)
  string(REPLACE "-" "_" src "${bench}")
  add_executable(${bench} MACOSX_BUNDLE ${src}.mm)
  set_target_properties(${bench} PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20
    BUILD_RPATH "${MPV_PREFIX}/lib"
    MACOSX_BUNDLE_BUNDLE_NAME "Tentacle ${bench}"
    MACOSX_BUNDLE_GUI_IDENTIFIER "tv.tentacle.cef.${bench}")
  target_compile_options(${bench} PRIVATE -fobjc-arc -Wall)
  target_include_directories(${bench} PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
  target_link_libraries(${bench} PRIVATE tentacle_player SDL3::SDL3)
endforeach()
