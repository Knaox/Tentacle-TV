# Octave — le mode musique (propriétaire : octave). Inclus par le CMakeLists
# racine (`add_subdirectory(src/music)`, APRÈS src/player, src/bridge et le
# socle) ou par le banc `tests/music/`.
if(NOT TARGET nlohmann_json::nlohmann_json)
  find_package(nlohmann_json 3.11 REQUIRED CONFIG)
endif()

# Le cœur : règles, file, moteur, transition douce, canaux — sans libmpv (une `AudioBackend`
# l'abstrait) : testé seul (`tests/`, les cas des tests d'Electron).
add_library(tentacle_music_core STATIC
  audio_types.cpp
  audio_options.cpp
  audio_rules.cpp
  audio_format.cpp
  audio_queue.cpp
  engine_state.cpp
  engine_ends.cpp
  crossfade_rules.cpp
  crossfade_pair.cpp
  crossfade_decks.cpp
  native_engine.cpp
  native_engine_io.cpp
  octave_channels.cpp
)
# Les en-têtes s'incluent en `music/…` depuis `src/`.
target_include_directories(tentacle_music_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/..")
target_link_libraries(tentacle_music_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_features(tentacle_music_core PUBLIC cxx_std_20)
if(NOT MSVC)
  target_compile_options(tentacle_music_core PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()
foreach(t audio_queue audio_rules crossfade_decks file_ends)
  add_executable(tentacle_music_${t}_tests tests/${t}_tests.cpp)
  target_link_libraries(tentacle_music_${t}_tests PRIVATE tentacle_music_core)
  add_test(NAME tentacle_music_${t}_tests COMMAND tentacle_music_${t}_tests)
endforeach()

# Le moteur sur libmpv : `Player` de vidéo-HDR (app), ou libmpv directe (banc de Homebrew).
add_library(tentacle_music STATIC mpv_audio_backend.cpp)
target_link_libraries(tentacle_music PUBLIC tentacle_music_core)
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
