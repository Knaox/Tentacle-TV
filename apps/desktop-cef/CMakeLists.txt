# Tentacle CEF — prototype : CEF (UI web, hors écran) + SDL3 (fenêtre) + libmpv (lecture).
# Construire avec scripts/build.sh (Ninja, ninja -j4), jamais dans le dépôt.
cmake_minimum_required(VERSION 3.24)
project(tentacle_cef LANGUAGES C CXX)
if(APPLE)
  enable_language(OBJC OBJCXX)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Paquet de distribution (scripts/build.sh --dist) : dylibs embarquées, rien hors du .app.
# Sans lui (développement), l'app trouve libmpv et SDL3 dans le cache et Homebrew.
option(TENTACLE_DIST "Paquet de distribution autonome (voir docs/PAQUET.md)" OFF)
if(TENTACLE_DIST)
  # Symboles de débogage compilés puis sortis en .dSYM (strip-symbols.sh) ; code mort retiré
  # au lien. Posé avant CEF pour valoir aussi pour libcef_dll_wrapper.
  add_compile_options(-g)
  add_link_options(-Wl,-dead_strip)
endif()

list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake")
include(TentacleCef)          # CEF épinglé + libcef_dll_wrapper (cible tentacle::cef)
# Notre code vise macOS 14+ (EDR moderne, ProMotion) ; le wrapper CEF garde ses 13.0.
set(CMAKE_OSX_DEPLOYMENT_TARGET 14.0)

find_package(SDL3 REQUIRED CONFIG)
find_package(nlohmann_json 3.11 REQUIRED CONFIG)

# --- Bibliothèque du socle : hôte CEF, IPC, saisie, compositeur ------------------------
add_library(tentacle_shell STATIC
  src/app/app.cpp
  src/app/args.cpp
  src/app/modules.cpp
  src/shell/browser_app.cpp
  src/shell/client.cpp
  src/shell/client_render.cpp
  src/shell/input.cpp
  src/shell/ipc.cpp
  src/shell/main_thread.cpp
  src/shell/shell.cpp
  src/shell/builtin_handlers.cpp
  src/shell/shell_shortcuts.cpp
  src/shell/app_scheme.cpp
  src/shell/web_root.cpp
  src/shell/paths.cpp  # reseau : dossier de données d'Electron, --user-data
)
# Code commun au rendu (renderer) : lié par l'app ET par les helpers.
add_library(tentacle_renderer STATIC
  src/shell/renderer_app.cpp
  src/shell/renderer_ipc.cpp
  src/shell/app_scheme_register.cpp
)
# Règle pure de tentacle://app (quel fichier du build web pour quel chemin) : sans CEF.
add_executable(tentacle_web_root_tests src/shell/tests/web_root_tests.cpp src/shell/web_root.cpp)
target_include_directories(tentacle_web_root_tests PRIVATE "${CMAKE_SOURCE_DIR}/src")
add_test(NAME tentacle_web_root_tests COMMAND tentacle_web_root_tests)
if(APPLE)
  target_sources(tentacle_shell PRIVATE
    src/platform/macos/app_mac.mm
    src/platform/macos/shell_message_pump_mac.mm
    src/platform/macos/shell_keymap_mac.cpp
    src/platform/macos/shell_native_input_mac.mm
    src/platform/macos/shell_menu_mac.mm
    src/platform/macos/shell_frame_clock_mac.mm
    src/platform/macos/compositor_mac.mm
    src/platform/macos/compositor_web_layer_mac.mm
    src/platform/macos/compositor_web_pipeline_mac.mm
    src/platform/macos/compositor_fake_video_mac.mm
  )
elseif(WIN32)
  target_sources(tentacle_shell PRIVATE src/shell/message_pump_sdl.cpp
                                        src/platform/windows/shell_stubs_windows.cpp
                                        src/platform/windows/compositor_windows.cpp)
else()
  # Linux (axe linux) : fenêtre SDL3 (Wayland ou X11), NOTRE contexte EGL pour la page,
  # vidéo en sous-surface Wayland ou par l'API de rendu de libmpv (src/platform/linux/).
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(TENTACLE_LINUX REQUIRED IMPORTED_TARGET
                    wayland-client wayland-egl egl glesv2 x11)
  target_sources(tentacle_shell PRIVATE src/shell/message_pump_sdl.cpp
                                        src/platform/linux/app_linux.cpp
                                        src/platform/linux/shell_linux.cpp
                                        src/platform/linux/graphics_session.cpp
                                        src/platform/linux/locale_linux.cpp
                                        src/platform/linux/edid_linux.cpp
                                        src/platform/linux/linux_commands.cpp
                                        src/platform/linux/egl_linux.cpp
                                        src/platform/linux/gl_quad_linux.cpp
                                        src/platform/linux/dmabuf_linux.cpp
                                        src/platform/linux/compositor_linux.cpp
                                        src/platform/linux/fake_video_linux.cpp)
  target_link_libraries(tentacle_shell PUBLIC PkgConfig::TENTACLE_LINUX)
  # Règles pures de Linux (session graphique, langues) : sans CEF ni affichage.
  add_executable(tentacle_linux_tests src/platform/linux/tests/linux_rules_tests.cpp
                 src/platform/linux/tests/edid_linux_tests.cpp
                 src/platform/linux/graphics_session.cpp src/platform/linux/locale_linux.cpp
                 src/platform/linux/edid_linux.cpp src/shell/paths.cpp)
  target_include_directories(tentacle_linux_tests PRIVATE "${CMAKE_SOURCE_DIR}/src")
  target_link_libraries(tentacle_linux_tests PRIVATE nlohmann_json::nlohmann_json)
  add_test(NAME tentacle_linux_tests COMMAND tentacle_linux_tests)
endif()

foreach(lib tentacle_shell tentacle_renderer)
  target_include_directories(${lib} PUBLIC "${CMAKE_SOURCE_DIR}/src")
  target_link_libraries(${lib} PUBLIC tentacle::cef nlohmann_json::nlohmann_json)
  # ARC pour l'Objective-C++ ; avertissements stricts sur notre code.
  target_compile_options(${lib} PRIVATE -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers
                         $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
endforeach()
target_link_libraries(tentacle_shell PUBLIC tentacle_renderer SDL3::SDL3)

# --- Modules du lot (propriétaires : vidéo-HDR, pont, octave) ---------------------------
# tentacle_player porte la surface vidéo (createVideoSurface, prepareWindowForVideo) : le
# socle en dépend. Le pont et octave sont construits ici ; leur branchement à l'app passe
# par src/app/modules.cpp.
add_subdirectory(src/player)
target_link_libraries(tentacle_shell PUBLIC tentacle_player)
if(EXISTS "${CMAKE_SOURCE_DIR}/src/bridge/CMakeLists.txt")
  add_subdirectory(src/bridge)
endif()
if(EXISTS "${CMAKE_SOURCE_DIR}/src/music/CMakeLists.txt")
  add_subdirectory(src/music)
endif()
if(EXISTS "${CMAKE_SOURCE_DIR}/src/update/CMakeLists.txt")
  add_subdirectory(src/update)  # maj : mise à jour automatique, assistant dans le paquet
endif()
add_subdirectory(src/net)  # reseau : tentacle://art, tentacle://plugin, relais, requêtes déléguées
add_subdirectory(src/lifecycle)  # systeme : cycle de vie, fenêtre d'Electron, instance unique, liens
if(APPLE)
  target_link_libraries(tentacle_shell PUBLIC
    "-framework Cocoa" "-framework Metal" "-framework QuartzCore" "-framework IOSurface"
    "-framework CoreVideo" "-framework Carbon")  # Carbon : disposition clavier (TIS, saisie)
endif()

# --- Exécutables et paquet .app --------------------------------------------------------
if(APPLE)
  include(MacBundle)
  tentacle_add_mac_app(
    NAME "Tentacle"
    BUNDLE_ID "tv.tentacle.proto.cef"
    MAIN_SOURCES src/app/main_mac.mm
    HELPER_SOURCES src/app/helper_main_mac.mm
    RESOURCES "${CMAKE_SOURCE_DIR}/tests/socle/page.html"
              "${CMAKE_SOURCE_DIR}/../desktop-electron/icons/icon.icns"  # systeme : l'icône d'Electron (Dock, « À propos »)
  )
elseif(WIN32)
  # Ébauche Windows (axe windows) : un exécutable unique, ressources CEF copiées à côté.
  add_executable(tentacle_app src/app/main_desktop.cpp)
  target_link_libraries(tentacle_app PRIVATE tentacle_shell)
else()
  include(LinuxApp)
  tentacle_add_linux_app(
    NAME "tentacle"
    SOURCES src/app/main_desktop.cpp
    RESOURCES "${CMAKE_SOURCE_DIR}/tests/socle/page.html"
  )
endif()
