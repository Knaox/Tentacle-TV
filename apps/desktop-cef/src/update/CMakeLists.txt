# Module maj : mise à jour automatique (macOS, Windows, Linux). Contrat : docs/MISE-A-JOUR.md.
#
# Inclus par le CMakeLists racine (`add_subdirectory(src/update)`), ou construit SEUL pour
# ses tests (sans CEF) — c'est ce que fait `pnpm test:update` :
#   cmake -S src/update -B ~/.cache/tentacle-cef/build/maj-tests -G Ninja && ninja -C … && ctest --test-dir …
cmake_minimum_required(VERSION 3.24)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(tentacle_update LANGUAGES C CXX)
  if(APPLE)
    enable_language(OBJCXX)
  endif()
  set(CMAKE_CXX_STANDARD 20)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  enable_testing()
endif()

find_package(nlohmann_json 3.11 REQUIRED)
# libsodium en STATIQUE : ed25519 + SHA-256, la même implémentation sur les trois OS, et
# aucune bibliothèque de plus dans le paquet (macOS : Homebrew ; Linux : libsodium-dev ;
# Windows : vcpkg libsodium:x64-windows-static).
find_package(PkgConfig QUIET)
if(PkgConfig_FOUND)
  pkg_check_modules(SODIUM_PC QUIET libsodium)
endif()
find_path(SODIUM_INCLUDE_DIR sodium.h HINTS ${SODIUM_PC_INCLUDE_DIRS} /opt/homebrew/opt/libsodium/include)
find_library(SODIUM_LIBRARY NAMES libsodium.a sodium libsodium
             HINTS ${SODIUM_PC_LIBRARY_DIRS} /opt/homebrew/opt/libsodium/lib)
if(NOT SODIUM_INCLUDE_DIR OR NOT SODIUM_LIBRARY)
  message(FATAL_ERROR "libsodium introuvable (macOS : brew install libsodium)")
endif()

set(UPDATE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/..")  # src/ : includes « update/… »
add_library(tentacle_update_core STATIC version.cpp crypto.cpp manifest.cpp state.cpp decision.cpp engine.cpp
                                        engine_lifecycle.cpp)
target_include_directories(tentacle_update_core PUBLIC "${UPDATE_ROOT}" "${SODIUM_INCLUDE_DIR}")
target_link_libraries(tentacle_update_core PUBLIC nlohmann_json::nlohmann_json "${SODIUM_LIBRARY}")
target_compile_features(tentacle_update_core PUBLIC cxx_std_20)
target_compile_options(tentacle_update_core PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall -Wextra -Wno-unused-parameter>)

add_executable(tentacle_update_tests tests/main.cpp tests/rule_tests.cpp tests/engine_tests.cpp
                                     tests/review_tests.cpp tests/invariant_tests.cpp)
target_include_directories(tentacle_update_tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(tentacle_update_tests PRIVATE tentacle_update_core)
add_test(NAME tentacle_update_tests COMMAND tentacle_update_tests)
add_executable(tentacle_update_verify tests/verify_main.cpp)  # relit un flux comme l'app (CI, banc)
target_link_libraries(tentacle_update_verify PRIVATE tentacle_update_core)

# L'assistant de remplacement (macOS) : petit exécutable (Foundation + Security), rangé dans
# Contents/MacOS/tentacle-update. Construit aussi SEUL : bench/update/helper-test.sh l'éprouve
# sur des paquets factices, sans fenêtre.
if(APPLE)
  add_executable(tentacle_update_helper helper/helper_mac.mm ../platform/macos/update_bundle_mac.mm)
  set_target_properties(tentacle_update_helper PROPERTIES OUTPUT_NAME tentacle-update)
  target_link_libraries(tentacle_update_helper PRIVATE tentacle_update_core "-framework Foundation"
                                                       "-framework Security")
  target_compile_options(tentacle_update_helper PRIVATE -fobjc-arc -Wall -Wextra)
endif()

# Linux et Windows : l'implémentation système est une bibliothèque à part, construite aussi
# SEULE (sans CEF) pour être éprouvée : bench/update/cross-test.sh (conteneur Debian : moteur
# réel sur de fausses AppImages ; mingw-w64 : compilation et liens Windows).
if(NOT APPLE)
  # Sans Info.plist, la version courante vient du build (la CI la tire de versions.json).
  set(TENTACLE_APP_VERSION "0.1.0" CACHE STRING "Version de l'app (Linux, Windows)")
  set(system_dir "${CMAKE_CURRENT_SOURCE_DIR}/../platform")
  if(WIN32)
    add_library(tentacle_update_system STATIC "${system_dir}/windows/update_windows.cpp")
    target_link_libraries(tentacle_update_system PUBLIC tentacle_update_core winhttp shell32)
    add_executable(tentacle_update_helper helper/helper_windows.cpp)
    set_target_properties(tentacle_update_helper PROPERTIES OUTPUT_NAME tentacle-update)
    target_link_libraries(tentacle_update_helper PRIVATE tentacle_update_core shell32)
    if(MINGW)  # wmain : MSVC le trouve seul, mingw le demande
      target_link_options(tentacle_update_helper PRIVATE -municode)
    endif()
  else()  # AppImage seulement : pas d'assistant, un guetteur sh (update_linux.cpp)
    find_package(CURL REQUIRED)
    add_library(tentacle_update_system STATIC "${system_dir}/linux/update_linux.cpp")
    target_link_libraries(tentacle_update_system PUBLIC tentacle_update_core CURL::libcurl)
    if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
      # Une fausse app par version (et deux défauts : morte avant le moteur, morte avant la bonne santé).
      foreach(variant "1.0.0:0" "1.0.1:0" "1.1.0:0" "1.1.0:1" "1.0.1:2")
        string(REPLACE ":" ";" parts "${variant}")
        list(GET parts 0 v)
        list(GET parts 1 fault)
        set(name "tentacle-e2e-app-${v}")
        if(NOT fault EQUAL 0)
          string(APPEND name "-fault${fault}")
        endif()
        add_executable(${name} tests/linux_e2e.cpp "${system_dir}/linux/update_linux.cpp")
        target_compile_definitions(${name} PRIVATE TENTACLE_APP_VERSION="${v}" TENTACLE_E2E_FAULT=${fault})
        target_link_libraries(${name} PRIVATE tentacle_update_core CURL::libcurl)
      endforeach()
      add_executable(tentacle-e2e-feed tests/e2e_feed.cpp)
      target_link_libraries(tentacle-e2e-feed PRIVATE tentacle_update_core)
    endif()
  endif()
  if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    add_executable(tentacle_update_system_check tests/system_check.cpp)  # liens complets
    target_link_libraries(tentacle_update_system_check PRIVATE tentacle_update_system)
  endif()
  target_compile_definitions(tentacle_update_system PRIVATE TENTACLE_APP_VERSION="${TENTACLE_APP_VERSION}")
  target_compile_options(tentacle_update_system PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall -Wextra -Wno-unused-parameter>)
endif()

# --- Dans l'app : colle avec le socle, implémentation système, assistant, surcouche ------
if(TARGET tentacle_shell)
  set(TENTACLE_UPDATE_FEED_URL "" CACHE STRING "Flux de mise à jour (enveloppe signée)")
  set(TENTACLE_UPDATE_PUBLIC_KEYS "" CACHE STRING "Clés publiques ed25519 de confiance : id:base64;…")

  # La surcouche JS est embarquée, comme le shim du pont, sa feuille de style glissée dans
  # le jeton __UPDATE_CSS__. Absente : script vide.
  set(overlay_js "${CMAKE_CURRENT_SOURCE_DIR}/../../web/shim/update-overlay.js")
  set(overlay_css "${CMAKE_CURRENT_SOURCE_DIR}/../../web/shim/update-overlay.css")
  set(TENTACLE_UPDATE_OVERLAY "")
  if(EXISTS "${overlay_js}")
    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${overlay_js}" "${overlay_css}")
    file(READ "${overlay_js}" TENTACLE_UPDATE_OVERLAY)
    file(READ "${overlay_css}" overlay_css_text)
    string(FIND "${overlay_css_text}" "`" backtick)
    string(FIND "${overlay_css_text}" "\${" interpolation)
    if(NOT backtick EQUAL -1 OR NOT interpolation EQUAL -1)
      message(FATAL_ERROR "update-overlay.css ne doit contenir ni accent grave ni dollar-accolade")
    endif()
    string(REPLACE "__UPDATE_CSS__" "${overlay_css_text}" TENTACLE_UPDATE_OVERLAY "${TENTACLE_UPDATE_OVERLAY}")
    string(FIND "${TENTACLE_UPDATE_OVERLAY}" ")tentacleupdate\"" clash)
    if(NOT clash EQUAL -1)
      message(FATAL_ERROR "update-overlay.js contient le délimiteur de chaîne brute")
    endif()
  endif()
  configure_file(overlay_source.cpp.in "${CMAKE_CURRENT_BINARY_DIR}/overlay_source.cpp" @ONLY)

  add_library(tentacle_update_glue STATIC update_shell.cpp "${CMAKE_CURRENT_BINARY_DIR}/overlay_source.cpp")
  target_compile_definitions(tentacle_update_glue PRIVATE
    TENTACLE_UPDATE_FEED_URL="${TENTACLE_UPDATE_FEED_URL}"
    TENTACLE_UPDATE_PUBLIC_KEYS="${TENTACLE_UPDATE_PUBLIC_KEYS}")
  target_link_libraries(tentacle_update_glue PUBLIC tentacle_update_core tentacle_shell)
  target_compile_options(tentacle_update_glue PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall -Wextra -Wno-unused-parameter>
                         $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
  # src/app/modules.cpp (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_update_glue)

  set(platform_dir "${CMAKE_CURRENT_SOURCE_DIR}/../platform")
  if(APPLE)
    target_sources(tentacle_update_glue PRIVATE "${platform_dir}/macos/update_platform_mac.mm"
                                                "${platform_dir}/macos/update_bundle_mac.mm")
    target_link_libraries(tentacle_update_glue PUBLIC "-framework Foundation" "-framework Security"
                                                      "-framework AppKit")

    # tentacle_app est défini plus bas dans le CMakeLists racine : résolu à la génération.
    # Paquet de distribution : l'assistant perd ses symboles comme le reste (docs/PAQUET.md).
    if(TENTACLE_DIST)
      add_custom_command(TARGET tentacle_update_helper POST_BUILD
        COMMAND "${CMAKE_SOURCE_DIR}/scripts/deps/strip-symbols.sh" "${CMAKE_BINARY_DIR}/symbols"
                "$<TARGET_FILE:tentacle_update_helper>"
        VERBATIM)
    endif()
    set(app_dir "$<TARGET_BUNDLE_DIR:tentacle_app>")
    set(stamp "${CMAKE_CURRENT_BINARY_DIR}/helper-embedded.stamp")
    add_custom_command(OUTPUT "${stamp}"
      COMMAND cp -f "$<TARGET_FILE:tentacle_update_helper>" "${app_dir}/Contents/MacOS/tentacle-update"
      COMMAND codesign --force --sign - --timestamp=none "${app_dir}/Contents/MacOS/tentacle-update"
      COMMAND codesign --force --sign - --timestamp=none "${app_dir}"
      COMMAND ${CMAKE_COMMAND} -E touch "${stamp}"
      DEPENDS tentacle_update_helper "$<TARGET_FILE:tentacle_update_helper>" "$<TARGET_FILE:tentacle_app>"
      COMMENT "Assistant de mise à jour dans le paquet, signature ad hoc"
      VERBATIM)
    add_custom_target(tentacle_update_embed ALL DEPENDS "${stamp}")
    add_dependencies(tentacle_update_embed tentacle_app tentacle_update_helper)
  elseif(WIN32)
    set_target_properties(tentacle_update_helper PROPERTIES RUNTIME_OUTPUT_DIRECTORY "$<TARGET_FILE_DIR:tentacle_app>")
  endif()
  if(NOT APPLE)
    target_link_libraries(tentacle_update_glue PUBLIC tentacle_update_system)
  endif()
endif()
