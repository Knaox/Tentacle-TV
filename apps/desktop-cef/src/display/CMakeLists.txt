# Module écran (lot cef-parite, axe windows) : HDR de l'écran (`display_hdr_state`,
# `display_hdr_auto`, session HDR d'une lecture), annexes du lecteur que la page appelle sur
# tous les OS (`mpv_harden_child_window`), commandes propres à un OS (Windows : Microsoft Store).
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/display)`), ou construit SEUL pour
# éprouver sa règle sans CEF :
#   cmake -S src/display -B ~/.cache/tentacle-cef/build/display-tests -G Ninja && ninja -C … && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_display LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()
if(NOT TARGET nlohmann_json::nlohmann_json)
  find_package(nlohmann_json 3.11 REQUIRED)
endif()

set(_src "${CMAKE_CURRENT_SOURCE_DIR}/..")
# La règle, sans CEF ni OS : session HDR (hdrSession.ts) et verdict du Store (msixInstallState.ts).
add_library(tentacle_display_core STATIC hdr_session.cpp msix_rule.cpp)
target_include_directories(tentacle_display_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}" "${_src}" "${_src}/bridge")
target_link_libraries(tentacle_display_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_display_core PUBLIC cxx_std_20)

add_executable(tentacle_display_tests tests/display_tests.cpp)
target_link_libraries(tentacle_display_tests PRIVATE tentacle_display_core)
add_test(NAME tentacle_display_tests COMMAND tentacle_display_tests)

# La colle avec le proto (registre du pont, session vidéo, fenêtre) et l'OS.
if(TARGET tentacle_shell AND TARGET tentacle_bridge_glue)
  add_library(tentacle_display STATIC display_channels.cpp)
  target_link_libraries(tentacle_display PUBLIC tentacle_display_core tentacle_bridge_glue tentacle_shell)
  set(_os "${_src}/platform")
  if(APPLE)
    target_sources(tentacle_display PRIVATE "${_os}/macos/display_hdr_mac.mm")
    target_compile_options(tentacle_display PRIVATE $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
    target_link_libraries(tentacle_display PUBLIC "-framework AppKit")
  elseif(WIN32)
    target_sources(tentacle_display PRIVATE "${_os}/windows/display_hdr_windows.cpp"
                                            "${_os}/windows/msix_update_windows.cpp"
                                            "${_os}/windows/os_commands_windows.cpp")
    target_link_libraries(tentacle_display PUBLIC user32 shell32 runtimeobject)
  else()
    target_sources(tentacle_display PRIVATE "${_os}/linux/display_hdr_linux.cpp")
  endif()
  # src/app/modules.cpp (dans tentacle_shell) appelle display::install : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_display)
endif()
