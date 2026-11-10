# Axe reseau (lot cef-parite) : dossier de données d'Electron (shell/paths), schémas
# tentacle://art et tentacle://plugin, relais Jellyfin, requêtes déléguées, media_warm.
# Règles pures testées sans CEF (ctest) ; le branchement à l'app passe par src/app/modules.cpp.

enable_testing()  # ctest --test-dir <build>/src/net

# --- Règles pures (sans CEF), portables sur les trois OS -----------------------------------
add_library(tentacle_net_core STATIC
  sha256.cpp
  web_url.cpp
  web_text.cpp
  fs_platform.cpp
  art_policy.cpp
  art_cache.cpp
  csp.cpp
  plugin_documents.cpp
)
target_include_directories(tentacle_net_core PUBLIC "${CMAKE_SOURCE_DIR}/src")
target_compile_features(tentacle_net_core PUBLIC cxx_std_20)
target_compile_options(tentacle_net_core PRIVATE -Wall -Wextra -Wno-unused-parameter)

# --- Commandes de la page, sans CEF (le réseau est injecté) : testées seules -------------
if(TARGET tentacle_bridge)
  add_library(tentacle_net_commands STATIC
    arg_check.cpp
    jellyfin_relay.cpp
    client_fetch_policy.cpp
    client_fetch_run.cpp
    client_fetch_commands.cpp
    local_socket.cpp
    direct_relay.cpp
    direct_relay_serve.cpp
    direct_source.cpp
  )
  target_link_libraries(tentacle_net_commands PUBLIC tentacle_net_core tentacle_bridge)
  target_compile_options(tentacle_net_commands PRIVATE -Wall -Wextra -Wno-unused-parameter)
  foreach(t jellyfin client_fetch client_fetch_policy direct_relay)
    add_executable(tentacle_${t}_tests tests/${t}_tests.cpp)
    target_link_libraries(tentacle_${t}_tests PRIVATE tentacle_net_commands)
    add_test(NAME tentacle_${t}_tests COMMAND tentacle_${t}_tests)
  endforeach()
endif()

# --- Tests des règles pures (sans CEF) ---------------------------------------------------
add_executable(tentacle_paths_tests tests/paths_tests.cpp "${CMAKE_SOURCE_DIR}/src/shell/paths.cpp")
target_include_directories(tentacle_paths_tests PRIVATE "${CMAKE_SOURCE_DIR}/src")
add_test(NAME tentacle_paths_tests COMMAND tentacle_paths_tests)
foreach(t art_policy art_cache plugin_csp)
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
    cef_stream.cpp
    cef_hop.cpp
    direct_shell.cpp
    net_shell.cpp
    ../schemes/buffered_handler.cpp
    ../schemes/art_scheme.cpp
    ../schemes/plugin_scheme.cpp
  )
  target_link_libraries(tentacle_net PUBLIC tentacle_net_core tentacle_net_commands tentacle_shell tentacle_bridge)
  # L'adieu à Jellyfin (axe systeme) : branché quand la cible du cycle de vie existe, où qu'elle
  # soit déclarée (expression évaluée à la génération, pas dans l'ordre des add_subdirectory).
  target_sources(tentacle_net PRIVATE
    $<IF:$<TARGET_EXISTS:tentacle_lifecycle>,${CMAKE_CURRENT_SOURCE_DIR}/farewell_lifecycle.cpp,${CMAKE_CURRENT_SOURCE_DIR}/farewell_stub.cpp>)
  target_link_libraries(tentacle_net PUBLIC $<TARGET_NAME_IF_EXISTS:tentacle_lifecycle>)
  target_compile_options(tentacle_net PRIVATE -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_net)
endif()
