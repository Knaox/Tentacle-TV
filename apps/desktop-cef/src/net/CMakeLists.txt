# Axe reseau (lot cef-parite) : dossier de données d'Electron (shell/paths), schémas
# tentacle://art et tentacle://plugin, relais Jellyfin, requêtes déléguées, media_warm.
# Règles pures testées sans CEF (ctest) ; le branchement à l'app passe par src/app/modules.cpp.

# --- Tests des règles pures (sans CEF) ---------------------------------------------------
enable_testing()  # ctest --test-dir <build>/src/net
add_executable(tentacle_paths_tests tests/paths_tests.cpp "${CMAKE_SOURCE_DIR}/src/shell/paths.cpp")
target_include_directories(tentacle_paths_tests PRIVATE "${CMAKE_SOURCE_DIR}/src")
add_test(NAME tentacle_paths_tests COMMAND tentacle_paths_tests)
