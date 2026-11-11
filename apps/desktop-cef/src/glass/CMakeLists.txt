# Module verre (Liquid Glass de macOS 26) : règles pures (portées de l'ancienne coquille
# Electron), glue avec l'app (canaux, échantillonneur),
# verre natif par OS (macOS seulement : ailleurs, l'option n'existe pas).
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/glass)`), ou construit SEUL pour les
# tests (règles : ni CEF, ni AppKit) :
#   cmake -S src/glass -B ~/.cache/tentacle-cef/build/glass-tests -G Ninja && ninja -C … -j2 \
#     && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_glass LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
endif()
# Aussi dans l'app : `ctest --test-dir <build>/src/glass` joue les tests sans la racine.
enable_testing()

find_package(nlohmann_json 3.11 REQUIRED)
set(TENTACLE_SRC "${CMAKE_CURRENT_SOURCE_DIR}/..")

add_library(tentacle_glass_core STATIC
  availability.cpp
  validate.cpp
  geometry.cpp
  spring_curve.cpp
  materialize.cpp
  stage.cpp
  regions.cpp
  regions_mount.cpp
  snapshot.cpp
  luminance.cpp
  video_layout.cpp
)
target_include_directories(tentacle_glass_core PUBLIC "${TENTACLE_SRC}")
target_link_libraries(tentacle_glass_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_glass_core PUBLIC cxx_std_20)
target_compile_options(tentacle_glass_core PRIVATE -Wall -Wextra -Wno-unused-parameter)

add_executable(tentacle_glass_tests
  tests/main.cpp tests/rules_tests.cpp tests/validate_tests.cpp tests/regions_tests.cpp
  tests/materialize_tests.cpp tests/luminance_tests.cpp)
target_link_libraries(tentacle_glass_tests PRIVATE tentacle_glass_core)
add_test(NAME tentacle_glass_tests COMMAND tentacle_glass_tests)

# Le verrou du Mac App Store (`privateApi.test.ts` d'Electron) : aucune API PRIVÉE du verre,
# pas même son nom, dans ce qui part dans le paquet.
add_test(NAME tentacle_glass_private_api
  COMMAND ${CMAKE_COMMAND} -DROOT=${TENTACLE_SRC}/..
          -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/private_api.cmake)

# Le lot du shim (`batcher.test.ts` d'Electron) : le vrai `tentacle-bridge.js`, joué sous Node.
find_program(TENTACLE_NODE node)
if(TENTACLE_NODE)
  add_test(NAME tentacle_glass_shim_tests
    COMMAND ${TENTACLE_NODE} --test ${CMAKE_CURRENT_SOURCE_DIR}/tests/shim_glass.test.mjs)
endif()

# La glue avec l'app : canaux de la page, échantillonneur, verre natif par OS. Seulement quand
# ces cibles existent — le module reste constructible seul pour ses tests.
if(TARGET tentacle_shell AND TARGET tentacle_bridge_glue AND TARGET tentacle_lifecycle)
  add_library(tentacle_glass_glue STATIC glass_shell.cpp glass_sampler.cpp glass_video.cpp)
  if(APPLE)
    target_sources(tentacle_glass_glue PRIVATE
      "${TENTACLE_SRC}/platform/macos/glass_backend_mac.mm"
      "${TENTACLE_SRC}/platform/macos/glass_platform_mac.mm")
    target_link_libraries(tentacle_glass_glue PUBLIC "-framework AppKit" "-framework QuartzCore" "-framework IOSurface")
  elseif(WIN32)
    target_sources(tentacle_glass_glue PRIVATE "${TENTACLE_SRC}/platform/windows/glass_windows.cpp")
  else()
    target_sources(tentacle_glass_glue PRIVATE "${TENTACLE_SRC}/platform/linux/glass_linux.cpp")
  endif()
  target_link_libraries(tentacle_glass_glue PUBLIC tentacle_glass_core tentacle_bridge_glue tentacle_lifecycle
                        tentacle_shell tentacle_player)
  target_compile_options(tentacle_glass_glue PRIVATE -Wall -Wextra -Wno-unused-parameter
                         $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la glue : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_glass_glue)
endif()
