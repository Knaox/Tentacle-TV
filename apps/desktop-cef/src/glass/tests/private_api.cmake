# Le verrou du Mac App Store (`privateApi.test.ts` d'Electron) : aucune API PRIVÉE du verre
# dans ce qui part dans le paquet — pas même son NOM dans un commentaire (un examen
# automatique du Store cherche aussi des noms en texte).
#
# Le verre ne passe que par les propriétés publiques d'AppKit (`glass_backend_mac.mm`). Les
# variantes que d'autres atteignent par des sélecteurs non publics (`electron-liquid-glass`,
# `docs/LIQUID-GLASS.md` § 2) ne sont ni appelées ni citées.
#
#   cmake -DROOT=<apps/desktop-cef> -P private_api.cmake
if(NOT ROOT)
  message(FATAL_ERROR "ROOT manquant (dossier apps/desktop-cef)")
endif()

# Ce qu'aucun fichier livré ne doit contenir — écrit ici, dans un test, qui ne part pas.
set(FORBIDDEN set_variant _variant scrimState subduedState _adaptiveAppearance _useReducedShadowRadius)

file(GLOB_RECURSE shipped
  "${ROOT}/src/*.h" "${ROOT}/src/*.cpp" "${ROOT}/src/*.mm" "${ROOT}/src/*.in"
  "${ROOT}/web/shim/*.js")
list(FILTER shipped EXCLUDE REGEX "/tests/|/dev/|_tests?\\.(cpp|mm)$")
# Le paquet du Mac App Store est le build macOS : le code de Linux et de Windows n'y entre pas
# (et GLib y a ses `g_variant_*`, sans rapport avec le verre).
list(FILTER shipped EXCLUDE REGEX "/src/platform/(linux|windows)/")

# Le verre natif et le shim sont bien relus.
foreach(expected "src/platform/macos/glass_backend_mac.mm" "web/shim/tentacle-bridge.js")
  if(NOT EXISTS "${ROOT}/${expected}")
    message(FATAL_ERROR "fichier attendu absent : ${expected}")
  endif()
  list(FIND shipped "${ROOT}/${expected}" found)
  if(found EQUAL -1)
    message(FATAL_ERROR "fichier attendu non relu : ${expected}")
  endif()
endforeach()

set(hits "")
foreach(file IN LISTS shipped)
  file(READ "${file}" content)
  foreach(name IN LISTS FORBIDDEN)
    string(FIND "${content}" "${name}" at)
    if(NOT at EQUAL -1)
      file(RELATIVE_PATH rel "${ROOT}" "${file}")
      list(APPEND hits "${rel} : ${name}")
    endif()
  endforeach()
endforeach()

list(LENGTH shipped count)
if(hits)
  string(REPLACE ";" "\n  " shown "${hits}")
  message(FATAL_ERROR "API privée du verre citée dans un fichier livré :\n  ${shown}")
endif()
message(STATUS "aucune API privée du verre dans ${count} fichiers livrés")
