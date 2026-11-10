# Lecteur (vidéo-HDR) : libmpv (notre fork + contexte moltenvk) et surface vidéo par OS.
# Depuis la racine : add_subdirectory(src/player) → cible `tentacle_player`.
# libmpv : MPV_PREFIX (défaut $TENTACLE_CEF_CACHE/deps/mpv/<sha8>, cf. scripts/deps/mpv-build.sh).
cmake_minimum_required(VERSION 3.24)

# b81be4b7 = base + 0001 (moltenvk) + 0002 (bascules de pistes sans vider le cache)
#            + 0003 (bascule audio sans gel de l'image) ;
# b1b076ea (sans 0003) puis b5c712f4 (sans 0002) : gardées en repli, avec un avertissement.
if(NOT DEFINED MPV_PREFIX)
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
  # Le matériel DirectComposition de la fenêtre vit ici : la surface vidéo et le compositeur
  # du socle (tentacle_shell, qui lie tentacle_player) en partagent le périphérique.
  target_sources(tentacle_player PRIVATE "${_src}/platform/windows/video_surface_windows.cpp"
                                         "${_src}/platform/windows/dcomp_context_windows.cpp")
  target_link_libraries(tentacle_player PUBLIC d3d11 dxgi dcomp)
else()
  target_sources(tentacle_player PRIVATE "${_src}/platform/linux/video_surface_linux.cpp")
endif()
set_target_properties(tentacle_player PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20)
target_include_directories(tentacle_player PUBLIC "${_src}" "${MPV_PREFIX}/include")
target_link_directories(tentacle_player PUBLIC "${MPV_PREFIX}/lib")
target_link_libraries(tentacle_player PUBLIC mpv nlohmann_json::nlohmann_json)
target_compile_options(tentacle_player PRIVATE -Wall -Wextra -Wno-unused-parameter
                       $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
# Le .app doit retrouver libmpv : rpath vers MPV_PREFIX/lib (prototype ; à embarquer plus tard).
set(TENTACLE_MPV_LIBDIR "${MPV_PREFIX}/lib" CACHE INTERNAL "")
