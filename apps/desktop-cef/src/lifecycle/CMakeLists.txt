# Module cycle de vie (axe systeme) : fermeture, arrière-plan, sortie, instance unique, liens,
# fenêtre d'Electron. Interface des autres modules : lifecycle.h.
#
# Le cœur est PUR (règles d'Electron portées, sans CEF ni SDL) et se teste seul :
#   cmake -S src/lifecycle -B ~/.cache/tentacle-cef/build/cycle -G Ninja && ninja -C … -j3 && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_lifecycle LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()

find_package(nlohmann_json 3.11 REQUIRED)

add_library(tentacle_lifecycle_core STATIC
  app_links.cpp
  background_drain.cpp
  close_sequence.cpp
  drag_regions.cpp
  exit_flow.cpp
  external_url.cpp
  playback_farewell.cpp
  power_save.cpp
  quit_guard.cpp
  texts.cpp
)
target_include_directories(tentacle_lifecycle_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/..")
target_link_libraries(tentacle_lifecycle_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_lifecycle_core PUBLIC cxx_std_20)
target_compile_options(tentacle_lifecycle_core PRIVATE -Wall -Wextra -Wno-unused-parameter)

add_executable(tentacle_lifecycle_tests
  tests/main.cpp
  tests/app_links_tests.cpp
  tests/exit_flow_tests.cpp
  tests/exit_rules_tests.cpp
  tests/external_url_tests.cpp
  tests/playback_farewell_tests.cpp
  tests/power_save_tests.cpp
)
target_include_directories(tentacle_lifecycle_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(tentacle_lifecycle_tests PRIVATE tentacle_lifecycle_core)
add_test(NAME tentacle_lifecycle_tests COMMAND tentacle_lifecycle_tests)
# window.tentacle (web/shim/tentacle-bridge.js) face au preload d'Electron : `node --test`.
find_program(TENTACLE_NODE node)
if(TENTACLE_NODE)
  add_test(NAME tentacle_shim_tests
           COMMAND "${TENTACLE_NODE}" --test "${CMAKE_CURRENT_SOURCE_DIR}/../../web/shim/tests/tentacle-bridge.test.mjs")
endif()

# La colle (CEF, SDL3, OS) : seulement dans l'app, quand le socle existe.
if(TARGET tentacle_shell)
  set(platform_dir "${CMAKE_CURRENT_SOURCE_DIR}/../platform")
  if(APPLE)
    set(lifecycle_os ${platform_dir}/macos/lifecycle_power_mac.mm
                     ${platform_dir}/macos/lifecycle_system_mac.mm
                     ${platform_dir}/macos/lifecycle_window_mac.mm)
  elseif(WIN32)
    set(lifecycle_os ${platform_dir}/windows/lifecycle_power_windows.cpp
                     ${platform_dir}/windows/lifecycle_system_windows.cpp
                     sdl_system.cpp)
  else()
    set(lifecycle_os ${platform_dir}/linux/lifecycle_power_linux.cpp
                     ${platform_dir}/linux/lifecycle_system_linux.cpp
                     sdl_system.cpp)
  endif()
  add_library(tentacle_lifecycle STATIC
    drag_hit_test.cpp
    hub.cpp
    lifecycle_app.cpp
    lifecycle_debug.cpp
    lifecycle_shell.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../shell/client_drag_regions.cpp  # CefDragHandler du Client
    ${lifecycle_os})
  target_link_libraries(tentacle_lifecycle PUBLIC tentacle_lifecycle_core tentacle_shell tentacle_bridge)
  target_compile_options(tentacle_lifecycle PRIVATE -Wall -Wextra -Wno-unused-parameter
                         -Wno-missing-field-initializers $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  # L'icône partagée des bureaux (`appIcon.ts`), pour la fenêtre en développement (Linux, Windows).
  target_compile_definitions(tentacle_lifecycle PRIVATE
    TENTACLE_DEV_ICON="${CMAKE_CURRENT_SOURCE_DIR}/../../../desktop-electron/icons/icon.png")
  if(APPLE)
    target_link_libraries(tentacle_lifecycle PUBLIC "-framework IOKit" "-framework UserNotifications")
  elseif(WIN32)
    target_link_libraries(tentacle_lifecycle PUBLIC shell32)
  else()
    target_link_libraries(tentacle_lifecycle PUBLIC ${CMAKE_DL_LIBS})
  endif()
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_lifecycle)
endif()
