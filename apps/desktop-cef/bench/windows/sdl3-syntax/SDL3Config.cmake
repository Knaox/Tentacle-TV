# SDL3 pour la compilation À BLANC (bench/windows/syntax-check.sh) : les en-têtes du paquet VC
# officiel (SDL3_VC_ROOT) et ses cibles, sans son contrôle de version — pensé pour MSVC, il
# écarte les compilateurs croisés. Le vrai build (pnpm dev:cef) prend le SDL3Config du paquet.
set(SDL3_FOUND TRUE)
set(SDL3_VERSION 3.4.16)
if(NOT TARGET SDL3::SDL3-shared)
  add_library(SDL3::SDL3-shared SHARED IMPORTED)
  set_target_properties(SDL3::SDL3-shared PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "${SDL3_VC_ROOT}/include"
    IMPORTED_IMPLIB "${SDL3_VC_ROOT}/lib/x64/SDL3.lib"
    IMPORTED_LOCATION "${SDL3_VC_ROOT}/lib/x64/SDL3.dll")
  add_library(SDL3::SDL3 INTERFACE IMPORTED)
  set_target_properties(SDL3::SDL3 PROPERTIES INTERFACE_LINK_LIBRARIES SDL3::SDL3-shared)
endif()
