# Localise la distribution CEF épinglée (scripts/deps/cef-version.env) et construit le
# wrapper C++ (libcef_dll_wrapper). Expose la cible d'interface tentacle::cef.
#
# Ordre de recherche de CEF_ROOT : -DCEF_ROOT=…, puis
# $TENTACLE_CEF_CACHE/deps/cef/<version> (défaut ~/.cache/tentacle-cef). Rien dans le dépôt.

file(STRINGS "${CMAKE_SOURCE_DIR}/scripts/deps/cef-version.env" _cef_line REGEX "^CEF_VERSION=")
string(REGEX REPLACE "^CEF_VERSION=\"([^\"]+)\".*" "\\1" TENTACLE_CEF_VERSION "${_cef_line}")

if(NOT CEF_ROOT)
  if(DEFINED ENV{TENTACLE_CEF_CACHE})
    set(_cache "$ENV{TENTACLE_CEF_CACHE}")
  else()
    set(_cache "$ENV{HOME}/.cache/tentacle-cef")
  endif()
  set(CEF_ROOT "${_cache}/deps/cef/${TENTACLE_CEF_VERSION}")
endif()
if(NOT EXISTS "${CEF_ROOT}/include/cef_version.h")
  message(FATAL_ERROR "CEF introuvable dans ${CEF_ROOT} — lancer scripts/deps/fetch-cef.sh")
endif()
set(CEF_ROOT "${CEF_ROOT}" CACHE PATH "Racine de la distribution CEF" FORCE)
message(STATUS "CEF ${TENTACLE_CEF_VERSION} : ${CEF_ROOT}")

# Les modules CMake de CEF fixent les drapeaux du wrapper (-fno-exceptions, -Werror…),
# la cible SDK et l'architecture. Notre code garde ses propres drapeaux (exceptions
# permises pour nlohmann::json).
list(APPEND CMAKE_MODULE_PATH "${CEF_ROOT}/cmake")
# Architecture de la distribution (cef_variables.cmake : fichiers livrés, pile du fil principal) :
# celle de la machine — macOS arm64 (épinglée), Linux et Windows x86_64 ou arm64.
if(CMAKE_SYSTEM_PROCESSOR MATCHES "^(AMD64|amd64|x86_64)$" AND NOT APPLE)
  set(PROJECT_ARCH "x86_64")
else()
  set(PROJECT_ARCH "arm64")
endif()
find_package(CEF REQUIRED)
if(OS_LINUX)
  # Les drapeaux du wrapper sont réglés pour le Clang de Chromium ; GCC (Fedora, Debian) y
  # trouve d'autres avertissements, que -Werror rendrait bloquants pour du code qui n'est pas
  # le nôtre. Linux seulement : macOS et Windows inchangés.
  list(REMOVE_ITEM CEF_COMPILER_FLAGS -Werror)
endif()
add_subdirectory("${CEF_LIBCEF_DLL_WRAPPER_PATH}" libcef_dll_wrapper EXCLUDE_FROM_ALL)

# macOS 13 minimum comme CEF ; notre code vise macOS 14+ en pratique (EDR, ProMotion).
add_library(tentacle_cef_iface INTERFACE)
target_include_directories(tentacle_cef_iface INTERFACE "${CEF_ROOT}")
target_link_libraries(tentacle_cef_iface INTERFACE libcef_dll_wrapper)
if(NOT APPLE)
  # Linux/Windows : lien direct à libcef (stubs, non construits ici).
  target_link_libraries(tentacle_cef_iface INTERFACE "${CEF_LIB_RELEASE}")
else()
  # macOS : framework LIÉ (axe ram), pas chargé par dlopen (CefScopedLibraryLoader). Seules
  # les images chargées au lancement ont droit à l'édition de liens paresseuse de dyld
  # (« page-in linking ») : chargé par dlopen, le framework a ses 12 Mo de __DATA_CONST
  # réécrits — donc sales — dans CHAQUE processus ; lié, 0 (mesuré : programme vide 16 Mo
  # → 2,5 Mo d'empreinte). Possible parce que nous tournons sans bac à sable (no_sandbox) :
  # rien n'oblige à initialiser un sandbox avant le chargement du framework. Le wrapper perd
  # donc ses talons dlsym (libcef_dll_dylib.cc) et son chargeur, comme sur Linux/Windows.
  get_target_property(_wrapper_srcs libcef_dll_wrapper SOURCES)
  list(FILTER _wrapper_srcs EXCLUDE REGEX "(libcef_dll_dylib\\.cc|cef_scoped_library_loader_mac\\.mm)$")
  set_property(TARGET libcef_dll_wrapper PROPERTY SOURCES ${_wrapper_srcs})
  set(TENTACLE_CEF_FRAMEWORK_BINARY
    "${CEF_BINARY_DIR_RELEASE}/Chromium Embedded Framework.framework/Chromium Embedded Framework")
  target_link_libraries(tentacle_cef_iface INTERFACE "${TENTACLE_CEF_FRAMEWORK_BINARY}")
endif()
add_library(tentacle::cef ALIAS tentacle_cef_iface)
set(TENTACLE_CEF_RELEASE_DIR "${CEF_BINARY_DIR_RELEASE}")
