# Chaîne de la compilation À BLANC pour Windows (bench/windows/syntax-check.sh) : configure
# l'arbre COMME sous Windows (WIN32, sources et définitions de chaque module, CEF windows64),
# avec un compilateur ciblant x86_64-w64-mingw32 — clang d'Apple (mingw-clang++.sh) ou GCC de
# mingw-w64 (conteneur). Jamais pour construire : ni édition de liens, ni ressources.
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR AMD64)
set(TENTACLE_WINDOWS_SYNTAX ON CACHE BOOL "Configuration pour la compilation à blanc (pas de binaire)")
# Les essais de CMake s'arrêtent à l'objet : aucune bibliothèque de Windows à lier sur le Mac.
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
# Les paquets viennent des chemins donnés (SDL3_DIR, nlohmann_json_DIR, CEF_ROOT…), jamais d'une
# racine de système Windows qui n'existe pas ici.
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE BOTH)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY BOTH)
# Jamais un paquet du Mac (Homebrew : SDL3 de macOS…) : seulement les chemins donnés.
set(CMAKE_FIND_USE_CMAKE_SYSTEM_PATH OFF)
set(CMAKE_FIND_USE_SYSTEM_ENVIRONMENT_PATH OFF)
set(CMAKE_FIND_USE_PACKAGE_REGISTRY OFF)
set(CMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY OFF)
# Rien n'est archivé ni lié : les essais de CMake (CMAKE_TRY_COMPILE_TARGET_TYPE) passent par des
# outils neutres ; ninja vient de -DCMAKE_MAKE_PROGRAM (syntax-check.sh).
set(CMAKE_AR /usr/bin/true CACHE FILEPATH "Archiveur (mode syntaxe : aucun)")
set(CMAKE_RANLIB /usr/bin/true CACHE FILEPATH "ranlib (mode syntaxe : aucun)")
