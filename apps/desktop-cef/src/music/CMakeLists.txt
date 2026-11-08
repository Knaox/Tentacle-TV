# Octave — le mode musique (propriétaire : octave). Inclus par le CMakeLists
# racine (`add_subdirectory(src/music)`, APRÈS src/player, src/bridge et le
# socle) ou par le banc `tests/music/`.
if(NOT TARGET nlohmann_json::nlohmann_json)
  find_package(nlohmann_json 3.11 REQUIRED CONFIG)
endif()

add_library(tentacle_music STATIC
  audio_options.cpp
  audio_types.cpp
  audio_engine.cpp
  audio_engine_state.cpp
  octave_channels.cpp
  mpv_audio_backend.cpp
)
# Les en-têtes s'incluent en `music/…` depuis `src/`.
target_include_directories(tentacle_music PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/..")
target_link_libraries(tentacle_music PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_music PUBLIC cxx_std_20)
target_compile_options(tentacle_music PRIVATE -Wall -Wextra -Wno-unused-parameter)

# libmpv : celle du lecteur de vidéo-HDR (le fork) quand il est construit — la
# musique tourne alors sur `Player` en audio seul ; sinon libmpv de Homebrew.
if(TARGET tentacle_player)
  target_sources(tentacle_music PRIVATE player_audio_backend.cpp)
  target_link_libraries(tentacle_music PUBLIC tentacle_player)
  target_compile_definitions(tentacle_music PUBLIC TENTACLE_MUSIC_HAS_PLAYER=1)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(MPV REQUIRED IMPORTED_TARGET mpv)
  target_link_libraries(tentacle_music PUBLIC PkgConfig::MPV)
endif()

# La colle avec le socle (fil principal) et le pont (registre des canaux).
if(TARGET tentacle_shell AND TARGET tentacle_bridge)
  target_sources(tentacle_music PRIVATE octave_shell.cpp)
  target_link_libraries(tentacle_music PUBLIC tentacle_shell tentacle_bridge)
  # `src/app/modules.cpp` (dans tentacle_shell) appelle la colle : lien dans les deux sens.
  target_link_libraries(tentacle_shell PUBLIC tentacle_music)
endif()
