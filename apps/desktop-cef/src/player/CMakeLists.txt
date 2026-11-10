# Lecteur (vidéo-HDR) : libmpv (notre fork + contexte moltenvk) et surface vidéo par OS.
# Depuis la racine : add_subdirectory(src/player) → cible `tentacle_player`.
# libmpv : MPV_PREFIX (défaut $TENTACLE_CEF_CACHE/deps/mpv/<sha8>, cf. scripts/deps/mpv-build.sh).
cmake_minimum_required(VERSION 3.24)

# b81be4b7 = base + 0001 (moltenvk) + 0002 (bascules de pistes sans vider le cache)
#            + 0003 (bascule audio sans gel de l'image) ;
# b1b076ea (sans 0003) puis b5c712f4 (sans 0002) : gardées en repli, avec un avertissement.
# Linux : le lanceur (scripts/dev/linux.mjs) donne MPV_PREFIX (notre fork) ou
# TENTACLE_MPV_SYSTEM=ON (libmpv de la distribution, par pkg-config).
option(TENTACLE_MPV_SYSTEM "Linux : libmpv de la distribution (pkg-config mpv)" OFF)
if(NOT DEFINED MPV_PREFIX AND NOT TENTACLE_MPV_SYSTEM)
  if(DEFINED ENV{TENTACLE_CEF_CACHE})
    set(_mpv_root "$ENV{TENTACLE_CEF_CACHE}/deps/mpv")
  else()
    set(_mpv_root "$ENV{HOME}/.cache/tentacle-cef/deps/mpv")
  endif()
  set(MPV_PREFIX "${_mpv_root}/b81be4b7")
  foreach(_old b1b076ea b5c712f4)
    if(NOT EXISTS "${MPV_PREFIX}/lib" AND EXISTS "${_mpv_root}/${_old}/lib")
      message(WARNING "libmpv b81be4b7 absente : repli sur ${_old} (correctifs de bascule de "
                      "pistes incomplets). Lancer scripts/deps/mpv-build.sh.")
      set(MPV_PREFIX "${_mpv_root}/${_old}")
    endif()
  endforeach()
endif()
if(NOT TARGET nlohmann_json::nlohmann_json)
  find_package(nlohmann_json 3.11 REQUIRED CONFIG)
endif()

set(_src "${CMAKE_CURRENT_SOURCE_DIR}/..")
add_library(tentacle_player STATIC
  player.cpp
  mpv_node.cpp
  sound_policy.cpp)
if(APPLE)
  target_sources(tentacle_player PRIVATE "${_src}/platform/macos/video_surface_macos.mm")
  target_link_libraries(tentacle_player PUBLIC "-framework AppKit" "-framework Metal"
                        "-framework QuartzCore")
elseif(WIN32)
  target_sources(tentacle_player PRIVATE "${_src}/platform/windows/video_surface_windows.cpp")
else()
  # Linux (axe linux) : sous-surface Wayland (contexte wlhostvk de notre libmpv) ou API de
  # rendu OpenGL de libmpv dans le contexte EGL du compositeur.
  find_package(PkgConfig REQUIRED)
  find_package(SDL3 REQUIRED CONFIG)
  pkg_check_modules(TENTACLE_PLAYER_LINUX REQUIRED IMPORTED_TARGET wayland-client glesv2)
  target_sources(tentacle_player PRIVATE "${_src}/platform/linux/video_surface_linux.cpp"
                                         "${_src}/platform/linux/video_subsurface_linux.cpp")
  target_link_libraries(tentacle_player PUBLIC PkgConfig::TENTACLE_PLAYER_LINUX SDL3::SDL3)
  # Le contexte `wlhostvk` n'existe que dans notre fork (mpv-patches-linux/0004).
  if(NOT TENTACLE_MPV_SYSTEM)
    pkg_get_variable(_wl_protocols wayland-protocols pkgdatadir)
    pkg_get_variable(_wl_scanner wayland-scanner wayland_scanner)
    set(_vp "${_wl_protocols}/stable/viewporter/viewporter.xml")
    set(_gen "${CMAKE_CURRENT_BINARY_DIR}/wayland")
    file(MAKE_DIRECTORY "${_gen}")
    add_custom_command(
      OUTPUT "${_gen}/viewporter-client-protocol.h" "${_gen}/viewporter-protocol.c"
      COMMAND "${_wl_scanner}" client-header "${_vp}" "${_gen}/viewporter-client-protocol.h"
      COMMAND "${_wl_scanner}" private-code "${_vp}" "${_gen}/viewporter-protocol.c"
      DEPENDS "${_vp}" VERBATIM)
    target_sources(tentacle_player PRIVATE "${_gen}/viewporter-protocol.c"
                                           "${_gen}/viewporter-client-protocol.h")
    target_include_directories(tentacle_player PRIVATE "${_gen}")
    target_compile_definitions(tentacle_player PRIVATE TENTACLE_MPV_WAYLAND_HOST=1)
  endif()
endif()
set_target_properties(tentacle_player PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20)
if(TENTACLE_MPV_SYSTEM)
  pkg_check_modules(TENTACLE_MPV REQUIRED IMPORTED_TARGET mpv)
  target_include_directories(tentacle_player PUBLIC "${_src}")
  target_link_libraries(tentacle_player PUBLIC PkgConfig::TENTACLE_MPV nlohmann_json::nlohmann_json)
  set(MPV_PREFIX "")
else()
  target_include_directories(tentacle_player PUBLIC "${_src}" "${MPV_PREFIX}/include")
  target_link_directories(tentacle_player PUBLIC "${MPV_PREFIX}/lib")
  target_link_libraries(tentacle_player PUBLIC mpv nlohmann_json::nlohmann_json)
endif()
target_compile_options(tentacle_player PRIVATE -Wall -Wextra -Wno-unused-parameter
                       $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
# Le .app doit retrouver libmpv : rpath vers MPV_PREFIX/lib (prototype ; à embarquer plus tard).
if(MPV_PREFIX)
  set(TENTACLE_MPV_LIBDIR "${MPV_PREFIX}/lib" CACHE INTERNAL "")
else()
  set(TENTACLE_MPV_LIBDIR "" CACHE INTERNAL "")
endif()
