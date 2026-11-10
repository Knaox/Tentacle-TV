# « À l'écoute » et touches média (propriétaire : medias). Inclus par le CMakeLists racine
# (`add_subdirectory(src/media_session)`, APRÈS src/bridge et src/music), ou construit SEUL
# pour ses tests (cœur portable, sans CEF ni OS) :
#   cmake -S src/media_session -B ~/.cache/tentacle-cef/build/media-session && ninja -C … && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_media_session LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()

set(_src "${CMAKE_CURRENT_SOURCE_DIR}/..")

# Le cœur portable : quelle source montrer, ce qui part vers l'OS, la pochette.
add_library(tentacle_media_session_core STATIC media_session_hub.cpp artwork_rules.cpp)
target_include_directories(tentacle_media_session_core PUBLIC "${_src}")
target_compile_features(tentacle_media_session_core PUBLIC cxx_std_20)
if(NOT MSVC)
  target_compile_options(tentacle_media_session_core PRIVATE -Wall -Wextra)
endif()

add_executable(tentacle_media_session_tests tests/media_session_tests.cpp)
target_link_libraries(tentacle_media_session_tests PRIVATE tentacle_media_session_core)
add_test(NAME tentacle_media_session_tests COMMAND tentacle_media_session_tests)

# La colle (canaux `smtc_*`, musique, pochettes par CEF) et la couture de l'OS : seulement
# dans l'app, quand le socle et le pont existent.
if(TARGET tentacle_shell AND TARGET tentacle_bridge)
  add_library(tentacle_media_session STATIC media_session_shell.cpp artwork_fetch_cef.cpp)
  target_link_libraries(tentacle_media_session PUBLIC tentacle_media_session_core tentacle_shell tentacle_bridge)
  if(APPLE)
    target_sources(tentacle_media_session PRIVATE "${_src}/platform/macos/media_session_macos.mm")
    target_link_libraries(tentacle_media_session PUBLIC "-framework MediaPlayer" "-framework AppKit")
    target_compile_options(tentacle_media_session PRIVATE $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  elseif(WIN32)
    # ABI WinRT + WRL (`windows.media.h`) : se vérifie aussi par mingw-w64 14 (en syntaxe).
    target_sources(tentacle_media_session PRIVATE
      "${_src}/platform/windows/media_session_windows.cpp"
      "${_src}/platform/windows/media_session_windows_audio.cpp"
      "${_src}/platform/windows/media_session_windows_debug.cpp"
      "${_src}/platform/windows/media_session_windows_display.cpp")
    target_link_libraries(tentacle_media_session PRIVATE runtimeobject ole32)
  else()
    # MPRIS par GDBus : gio-2.0, que Chromium charge déjà sous Linux (rien de neuf dans le processus).
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(TENTACLE_GIO REQUIRED IMPORTED_TARGET gio-2.0)
    target_sources(tentacle_media_session PRIVATE
      "${_src}/platform/linux/media_session_linux.cpp"
      "${_src}/platform/linux/media_session_linux_dbus.cpp"
      "${_src}/platform/linux/media_session_linux_props.cpp"
      "${_src}/platform/linux/media_session_linux_artwork.cpp")
    target_link_libraries(tentacle_media_session PRIVATE PkgConfig::TENTACLE_GIO)
  endif()
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_media_session)
endif()
