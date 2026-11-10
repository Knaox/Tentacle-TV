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
  playback_farewell.cpp
  power_save.cpp
  quit_guard.cpp
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
  tests/playback_farewell_tests.cpp
  tests/power_save_tests.cpp
)
target_include_directories(tentacle_lifecycle_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(tentacle_lifecycle_tests PRIVATE tentacle_lifecycle_core)
add_test(NAME tentacle_lifecycle_tests COMMAND tentacle_lifecycle_tests)

# La colle (CEF, SDL3, OS) : seulement dans l'app, quand le socle existe.
if(TARGET tentacle_shell)
  set(lifecycle_os "")
  if(APPLE)
    set(lifecycle_os
      ${CMAKE_CURRENT_SOURCE_DIR}/../platform/macos/lifecycle_power_mac.mm)
  elseif(WIN32)
    set(lifecycle_os
      ${CMAKE_CURRENT_SOURCE_DIR}/../platform/windows/lifecycle_power_windows.cpp)
  else()
    set(lifecycle_os
      ${CMAKE_CURRENT_SOURCE_DIR}/../platform/linux/lifecycle_power_linux.cpp)
  endif()
  add_library(tentacle_lifecycle STATIC hub.cpp ${lifecycle_os})
  target_link_libraries(tentacle_lifecycle PUBLIC tentacle_lifecycle_core tentacle_shell)
  target_compile_options(tentacle_lifecycle PRIVATE -Wall -Wextra -Wno-unused-parameter
                         $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  if(APPLE)
    target_link_libraries(tentacle_lifecycle PUBLIC "-framework IOKit")
  endif()
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_lifecycle)
endif()
