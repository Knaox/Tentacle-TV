# Module PiP (image dans l'image) : règles pures portées d'Electron, session et contrôleur
# portables, glue CEF (le navigateur du PiP, les commandes `pip_*`), fenêtre native par OS.
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/pip)`), ou construit SEUL pour les
# tests (règles, session, contrôleur : ni CEF ni SDL) :
#   cmake -S src/pip -B ~/.cache/tentacle-cef/build/pip-tests -G Ninja && ninja -C … -j3 \
#     && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_pip LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()

find_package(nlohmann_json 3.11 REQUIRED)
set(TENTACLE_SRC "${CMAKE_CURRENT_SOURCE_DIR}/..")

add_library(tentacle_pip_core STATIC
  rules/pip_frame.cpp
  rules/pip_placement.cpp
  rules/pip_motion.cpp
  rules/pip_resize_guard.cpp
  rules/pip_captions.cpp
  rules/pip_arming.cpp
  rules/pip_payload.cpp
  pip_session.cpp
  pip_controller.cpp
)
target_include_directories(tentacle_pip_core PUBLIC "${TENTACLE_SRC}")
target_link_libraries(tentacle_pip_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_pip_core PUBLIC cxx_std_20)
target_compile_options(tentacle_pip_core PRIVATE -Wall -Wextra -Wno-unused-parameter)

add_executable(tentacle_pip_tests
  tests/main.cpp tests/rules_tests.cpp tests/payload_tests.cpp tests/session_tests.cpp
  tests/controller_tests.cpp)
target_link_libraries(tentacle_pip_tests PRIVATE tentacle_pip_core)
add_test(NAME tentacle_pip_tests COMMAND tentacle_pip_tests)

# La glue avec l'app : le navigateur du PiP (CEF), les commandes (pont), la fenêtre native.
if(TARGET tentacle_shell AND TARGET tentacle_bridge)
  add_library(tentacle_pip_glue STATIC
    glue/pip_client.cpp
    glue/pip_install.cpp
    glue/pip_commands.cpp
  )
  if(APPLE)
    target_sources(tentacle_pip_glue PRIVATE
      "${TENTACLE_SRC}/platform/macos/compositor_pip_window_mac.mm"
      "${TENTACLE_SRC}/platform/macos/compositor_pip_view_mac.mm"
      "${TENTACLE_SRC}/platform/macos/compositor_pip_platform_mac.mm"
      "${TENTACLE_SRC}/platform/macos/compositor_pip_debug_mac.mm")
  elseif(WIN32)
    target_sources(tentacle_pip_glue PRIVATE "${TENTACLE_SRC}/platform/windows/pip_windows.cpp")
  else()
    target_sources(tentacle_pip_glue PRIVATE "${TENTACLE_SRC}/platform/linux/pip_linux.cpp")
  endif()
  target_link_libraries(tentacle_pip_glue PUBLIC tentacle_pip_core tentacle_bridge tentacle_shell)
  target_compile_options(tentacle_pip_glue PRIVATE -Wall -Wextra -Wno-unused-parameter
                         $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la glue : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_pip_glue)
endif()
