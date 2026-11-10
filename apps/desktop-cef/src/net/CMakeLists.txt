# Axe reseau (lot cef-parite) : dossier de données d'Electron (shell/paths), schémas
# tentacle://art et tentacle://plugin, relais Jellyfin, requêtes déléguées, media_warm.
# Règles pures testées sans CEF (ctest) ; le branchement à l'app passe par src/app/modules.cpp.

# --- Règles pures (sans CEF), portables sur les trois OS -----------------------------------
add_library(tentacle_net_core STATIC
  sha256.cpp
  web_url.cpp
  web_text.cpp
  fs_platform.cpp
  art_policy.cpp
  art_cache.cpp
)
target_include_directories(tentacle_net_core PUBLIC "${CMAKE_SOURCE_DIR}/src")
target_compile_features(tentacle_net_core PUBLIC cxx_std_20)
target_compile_options(tentacle_net_core PRIVATE -Wall -Wextra -Wno-unused-parameter)

# --- Tests des règles pures (sans CEF) ---------------------------------------------------
enable_testing()  # ctest --test-dir <build>/src/net
add_executable(tentacle_paths_tests tests/paths_tests.cpp "${CMAKE_SOURCE_DIR}/src/shell/paths.cpp")
target_include_directories(tentacle_paths_tests PRIVATE "${CMAKE_SOURCE_DIR}/src")
add_test(NAME tentacle_paths_tests COMMAND tentacle_paths_tests)
foreach(t art_policy art_cache)
  add_executable(tentacle_${t}_tests tests/${t}_tests.cpp)
  target_link_libraries(tentacle_${t}_tests PRIVATE tentacle_net_core)
  add_test(NAME tentacle_${t}_tests COMMAND tentacle_${t}_tests)
endforeach()
add_executable(tentacle_art_key_probe tests/art_key_probe.cpp)  # tools/art-key-xcheck.mjs
target_link_libraries(tentacle_art_key_probe PRIVATE tentacle_net_core)

# --- La colle avec l'app (CEF, IPC du socle, registre du pont) ----------------------------
if(TARGET tentacle_shell AND TARGET tentacle_bridge)
  add_library(tentacle_net STATIC
    cef_fetch.cpp
    net_shell.cpp
    ../schemes/buffered_handler.cpp
    ../schemes/art_scheme.cpp
  )
  target_link_libraries(tentacle_net PUBLIC tentacle_net_core tentacle_shell tentacle_bridge)
  target_compile_options(tentacle_net PRIVATE -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_net)
endif()
