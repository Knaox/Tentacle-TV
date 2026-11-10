# Le hors ligne (propriétaire : horsligne) : la base `tentacle-local.db` d'Electron, la
# session et les avatars, les titres gardés (moteur de transferts), la lecture locale,
# `tentacle://local`.
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/offline)`, APRÈS le pont), ou
# construit SEUL pour le cœur et ses tests (sans CEF) :
#   cmake -S src/offline -B ~/.cache/tentacle-cef/build/cef-horsligne-core -G Ninja
#   ninja -C … -j3 && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_offline LANGUAGES C CXX)
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
endif()
enable_testing()

if(NOT TARGET nlohmann_json::nlohmann_json)
  find_package(nlohmann_json 3.11 REQUIRED CONFIG)
endif()
include(${CMAKE_CURRENT_SOURCE_DIR}/sqlite.cmake)  # SQLite : système, ou amalgamation épinglée (Windows)

# --- Cœur : pur (SQLite, système de fichiers, JSON), testé seul ---------------------------
add_library(tentacle_offline_core STATIC
  core/args.cpp
  core/base64.cpp
  core/database.cpp
  core/engine.cpp
  core/engine_end.cpp
  core/engine_work.cpp
  core/enqueue.cpp
  core/files.cpp
  core/heal.cpp
  core/listing.cpp
  core/local_assets.cpp
  core/meta.cpp
  core/music_keep.cpp
  core/music_library.cpp
  core/paths.cpp
  core/playback.cpp
  core/queue.cpp
  core/reconcile.cpp
  core/schema.cpp
  core/session_cache.cpp
  core/snapshot.cpp
  core/sqlite.cpp
  core/store.cpp
  core/stream_driver.cpp
  core/subs.cpp
  core/transfer.cpp
  core/transfer_support.cpp
  core/trickplay.cpp
)
# Le `.part` à écritures positionnelles : POSIX (macOS, Linux) ou Windows (chemins larges).
if(WIN32)
  target_sources(tentacle_offline_core PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../platform/windows/offline_part_file_windows.cpp")
else()
  target_sources(tentacle_offline_core PRIVATE core/part_file_posix.cpp)
endif()
# Les en-têtes s'incluent en `offline/…` depuis `src/`.
target_include_directories(tentacle_offline_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/..")
target_link_libraries(tentacle_offline_core PUBLIC nlohmann_json::nlohmann_json tentacle_sqlite3)
target_compile_features(tentacle_offline_core PUBLIC cxx_std_20)
if(NOT MSVC)
  target_compile_options(tentacle_offline_core PRIVATE -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers)
endif()

# Tests de règle (le pendant des tests vitest d'Electron) ; les sources TypeScript de
# référence sont relues pour comparer ce qui doit l'être octet pour octet.
get_filename_component(TENTACLE_REPO_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../.." ABSOLUTE)
add_executable(tentacle_offline_tests
  tests/engine_tests.cpp
  tests/library_tests.cpp
  tests/main.cpp
  tests/reconcile_tests.cpp
  tests/schema_tests.cpp
  tests/session_tests.cpp
  tests/store_tests.cpp
  tests/transfer_tests.cpp
)
target_link_libraries(tentacle_offline_tests PRIVATE tentacle_offline_core)
target_include_directories(tentacle_offline_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_definitions(tentacle_offline_tests PRIVATE TENTACLE_REPO_ROOT="${TENTACLE_REPO_ROOT}")
add_test(NAME tentacle_offline_tests COMMAND tentacle_offline_tests)
# Le pendant C++ du banc de compatibilité avec la base d'Electron (`bench/offline/compat.sh`).
add_executable(tentacle_offline_compat tests/compat_main.cpp)
target_link_libraries(tentacle_offline_compat PRIVATE tentacle_offline_core)
target_compile_definitions(tentacle_offline_compat PRIVATE TENTACLE_REPO_ROOT="${TENTACLE_REPO_ROOT}")

# --- Colle avec l'app : fil hors ligne, commandes de `window.tentacle`, schéma local ------
if(TARGET tentacle_shell AND TARGET tentacle_bridge AND TARGET tentacle_net AND TARGET tentacle_lifecycle
   AND TARGET tentacle_music)
  add_library(tentacle_offline_glue STATIC
    glue/cef_transfer_net.cpp
    glue/commands.cpp
    glue/engine_channels.cpp
    glue/engine_runtime.cpp
    glue/fetchers.cpp
    glue/kept_audio.cpp
    glue/list_channels.cpp
    glue/local_scheme.cpp
    glue/offline_shell.cpp
    glue/offline_thread.cpp
    glue/runtime.cpp
    glue/session_channels.cpp
    glue/storage_channels.cpp
  )
  target_link_libraries(tentacle_offline_glue PUBLIC tentacle_offline_core tentacle_shell tentacle_bridge tentacle_net
                                                    tentacle_lifecycle tentacle_music)
  if(NOT MSVC)
    target_compile_options(tentacle_offline_glue PRIVATE -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers)
  endif()
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_offline_glue)
endif()
