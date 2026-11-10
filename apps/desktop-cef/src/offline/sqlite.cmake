# SQLite pour le hors ligne : cible `tentacle_sqlite3`.
#
# - macOS, Linux : le SQLite DU SYSTÈME (garde-fou RAM du lot : aucune deuxième copie
#   embarquée sans raison) — `libsqlite3` de macOS, `libsqlite3-dev` sous Linux.
# - Windows : aucun SQLite système exploitable ; l'amalgamation officielle, ÉPINGLÉE par
#   version et SHA-256 (le `sqlite3.c` qu'elle contient a été vérifié contre l'empreinte
#   SHA3-256 publiée par sqlite.org pour 3.46.1 :
#   186a1baa476b6d546de155160ca6d30ff7b7e6ee375f0bb6445e1a3d180a7dad).
#   Téléchargée une fois dans `$TENTACLE_CEF_CACHE/deps/sqlite/` (hors dépôt).
#   `-DTENTACLE_SQLITE_AMALGAMATION=ON` la force ailleurs (essais de compilation croisée).
option(TENTACLE_SQLITE_AMALGAMATION "SQLite embarqué (amalgamation épinglée)" ${WIN32})

if(TARGET tentacle_sqlite3)
  return()
endif()

if(NOT TENTACLE_SQLITE_AMALGAMATION)
  find_package(SQLite3 REQUIRED)
  add_library(tentacle_sqlite3 INTERFACE)
  # CMake 4 renomme la cible importée (`SQLite3::SQLite3`) ; l'ancien nom reste pour 3.x.
  if(TARGET SQLite3::SQLite3)
    target_link_libraries(tentacle_sqlite3 INTERFACE SQLite3::SQLite3)
  else()
    target_link_libraries(tentacle_sqlite3 INTERFACE SQLite::SQLite3)
  endif()
  return()
endif()

set(_sqlite_version 3460100)
set(_sqlite_sha256 77823cb110929c2bcb0f5d48e4833b5c59a8a6e40cdea3936b99e199dbbe5784)
if(DEFINED ENV{TENTACLE_CEF_CACHE})
  set(_sqlite_cache "$ENV{TENTACLE_CEF_CACHE}/deps/sqlite")
elseif(WIN32)
  file(TO_CMAKE_PATH "$ENV{USERPROFILE}/.cache/tentacle-cef/deps/sqlite" _sqlite_cache)
else()
  set(_sqlite_cache "$ENV{HOME}/.cache/tentacle-cef/deps/sqlite")
endif()
set(_sqlite_zip "${_sqlite_cache}/dl/sqlite-amalgamation-${_sqlite_version}.zip")
set(_sqlite_dir "${_sqlite_cache}/sqlite-amalgamation-${_sqlite_version}")

if(NOT EXISTS "${_sqlite_dir}/sqlite3.c")
  file(DOWNLOAD "https://www.sqlite.org/2024/sqlite-amalgamation-${_sqlite_version}.zip" "${_sqlite_zip}"
       EXPECTED_HASH SHA256=${_sqlite_sha256} TLS_VERIFY ON SHOW_PROGRESS)
  file(ARCHIVE_EXTRACT INPUT "${_sqlite_zip}" DESTINATION "${_sqlite_cache}")
endif()
file(SHA256 "${_sqlite_zip}" _sqlite_actual)
if(NOT _sqlite_actual STREQUAL _sqlite_sha256)
  message(FATAL_ERROR "SQLite : empreinte inattendue pour ${_sqlite_zip} (${_sqlite_actual})")
endif()

add_library(tentacle_sqlite3 STATIC "${_sqlite_dir}/sqlite3.c")
target_include_directories(tentacle_sqlite3 PUBLIC "${_sqlite_dir}")
# Les réglages par défaut (ceux du SQLite de Node, qui écrit la même base sous Electron),
# fils protégés (sérialisé), et rien qui charge du code (extensions).
target_compile_definitions(tentacle_sqlite3 PRIVATE SQLITE_THREADSAFE=1 SQLITE_OMIT_LOAD_EXTENSION=1)
if(NOT MSVC)
  target_compile_options(tentacle_sqlite3 PRIVATE -w)
endif()
