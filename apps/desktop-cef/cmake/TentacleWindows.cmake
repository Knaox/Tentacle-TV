# Windows (MSVC + Ninja) : les drapeaux de NOTRE code, l'exécutable, ses ressources et les DLL à
# côté de lui. Inclus par le CMakeLists racine juste après TentacleCef (axe windows, lot
# cef-parite). Le lanceur (scripts/dev/windows.mjs) le configure dans l'environnement de Visual
# Studio (vcvarsall x64) avec CEF_ROOT, SDL3_DIR, nlohmann_json_DIR, MPV_PREFIX, libsodium.
# ⚠️ Jamais construit dans le lot (aucun MSVC sur le Mac) : éprouvé par `pnpm dev:cef` sur un PC.

# Mode « syntaxe » (bench/windows/syntax-check.sh, toolchain-syntax.cmake) : un compilateur
# clang ou GCC ciblant x86_64-w64-mingw32 configure le MÊME arbre — sélection des sources par OS,
# définitions et chemins de chaque module — pour une compilation à blanc ; jamais un binaire.
if(NOT MSVC AND NOT TENTACLE_WINDOWS_SYNTAX)
  message(FATAL_ERROR "Windows : le build attend MSVC (Visual Studio Build Tools) — lancer pnpm dev:cef")
endif()
if(MSVC)
  enable_language(RC)  # icône, version, manifeste de l'exécutable
endif()

# Le CRT statique de CEF (/MT : cef_variables.cmake) pour TOUT le binaire : un seul runtime.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

# Sous Ninja, CEF VIDE CMAKE_CXX_FLAGS* (cef_variables.cmake, issue #2120) : ce qui manque à
# notre code revient ici, pour toutes les cibles créées ensuite (pas le wrapper de CEF).
if(MSVC)
add_compile_options(
  /utf-8                                 # sources UTF-8 : commentaires et chaînes en français
  /permissive- /Zc:__cplusplus /Zc:preprocessor
  /W3 /wd4100 /wd4244 /wd4267            # paramètres inutilisés, conversions (comme CEF)
  $<$<COMPILE_LANGUAGE:CXX>:/EHsc>       # exceptions : nlohmann::json, std::filesystem
  $<$<CONFIG:Release>:/O2> $<$<CONFIG:Release>:/Ob2>
  $<$<CONFIG:Debug>:/Od> $<$<CONFIG:Debug>:/Zi>
)
endif()
add_compile_definitions(
  NOMINMAX UNICODE _UNICODE             # pas WIN32_LEAN_AND_MEAN : l’assistant de maj veut shellapi.h
  _WIN32_WINNT=0x0A00 WINVER=0x0A00      # Windows 10 (DPI par écran v2 : 1703 ; MSIX : 2004)
  SODIUM_STATIC                          # libsodium statique (src/update)
  _CRT_SECURE_NO_WARNINGS
  $<$<CONFIG:Release>:NDEBUG>
)

# L'exécutable de l'app (et de ses sous-processus CEF) : Tentacle.exe dans <build>/app, avec
# tout ce qu'il charge à côté de lui — la disposition d'un paquet (docs/A-TESTER-WINDOWS.md).
function(tentacle_windows_app target)
  set(out "${CMAKE_BINARY_DIR}/app")
  set(res "${CMAKE_SOURCE_DIR}/resources/windows")
  # L'icône d'Electron (même visuel sur les trois OS, brand/ : jamais redessinée ici).
  set(TENTACLE_WINDOWS_ICON "${CMAKE_SOURCE_DIR}/../desktop-electron/icons/icon.ico")
  if(NOT DEFINED TENTACLE_APP_VERSION)
    set(TENTACLE_APP_VERSION "0.1.0")
  endif()
  # VERSIONINFO veut quatre nombres : « 1.42.0 » → 1,42,0,0 (un suffixe -beta… est ignoré).
  if(TENTACLE_APP_VERSION MATCHES "^([0-9]+)\\.([0-9]+)\\.([0-9]+)")
    set(TENTACLE_APP_VERSION_COMMAS "${CMAKE_MATCH_1},${CMAKE_MATCH_2},${CMAKE_MATCH_3}")
  else()
    set(TENTACLE_APP_VERSION_COMMAS "0,1,0")
  endif()
  configure_file("${res}/tentacle.rc.in" "${CMAKE_BINARY_DIR}/tentacle.rc" @ONLY)
  if(NOT MSVC)
    return()  # mode syntaxe : ni ressources, ni édition de liens, ni copies
  endif()
  target_sources(${target} PRIVATE "${CMAKE_BINARY_DIR}/tentacle.rc" "${res}/tentacle.exe.manifest")
  set_target_properties(${target} PROPERTIES
    OUTPUT_NAME "Tentacle"
    RUNTIME_OUTPUT_DIRECTORY "${out}"
    WIN32_EXECUTABLE ON)  # pas de console : les journaux suivent le terminal qui lance (pnpm)
  target_link_options(${target} PRIVATE
    /ENTRY:mainCRTStartup  # main() garde ses argv (UTF-8 : activeCodePage du manifeste)
    /STACK:0x800000)       # 8 Mio pour le fil principal, comme les exécutables de CEF (x64)
  target_link_libraries(${target} PRIVATE dwmapi)

  # Fichiers de CEF (cef_variables.cmake), SDL3.dll, libmpv-2.dll, page de test du socle.
  set(copies "")
  foreach(f IN LISTS CEF_BINARY_FILES)
    list(APPEND copies COMMAND ${CMAKE_COMMAND} -E copy_if_different "${CEF_BINARY_DIR_RELEASE}/${f}" "${out}/${f}")
  endforeach()
  foreach(f IN LISTS CEF_RESOURCE_FILES)
    if(IS_DIRECTORY "${CEF_RESOURCE_DIR}/${f}")
      list(APPEND copies COMMAND ${CMAKE_COMMAND} -E copy_directory "${CEF_RESOURCE_DIR}/${f}" "${out}/${f}")
    else()
      list(APPEND copies COMMAND ${CMAKE_COMMAND} -E copy_if_different "${CEF_RESOURCE_DIR}/${f}" "${out}/${f}")
    endif()
  endforeach()
  add_custom_command(TARGET ${target} POST_BUILD
    ${copies}
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "$<TARGET_FILE:SDL3::SDL3-shared>" "${out}/"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${MPV_PREFIX}/bin/libmpv-2.dll" "${out}/"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${CMAKE_SOURCE_DIR}/tests/socle/page.html" "${out}/"
    COMMENT "Ressources de CEF, SDL3.dll, libmpv-2.dll à côté de Tentacle.exe"
    VERBATIM)
endfunction()

# Les modules posent en dur des drapeaux de clang/gcc (-Wall, -Wextra, -W…, -f…) : cl.exe ne
# les comprend pas (D9002) — ou, pour -Wall, les lit comme /Wall, des milliers d'avertissements
# des en-têtes du SDK. Retirés de toutes les cibles du projet, sans toucher aux CMakeLists des
# modules. Une option prise dans une expression génératrice ($<…>) reste équilibrée : seules
# les entrées nues sont retirées.
function(_tentacle_collect_targets dir out)
  get_property(found DIRECTORY "${dir}" PROPERTY BUILDSYSTEM_TARGETS)
  get_property(subdirs DIRECTORY "${dir}" PROPERTY SUBDIRECTORIES)
  foreach(sub IN LISTS subdirs)
    _tentacle_collect_targets("${sub}" more)
    list(APPEND found ${more})
  endforeach()
  set(${out} ${found} PARENT_SCOPE)
endfunction()

function(tentacle_windows_finalize)
  if(NOT MSVC)
    return()  # mode syntaxe : clang et GCC comprennent ces drapeaux
  endif()
  _tentacle_collect_targets("${CMAKE_SOURCE_DIR}" targets)
  foreach(t IN LISTS targets)
    if(t STREQUAL "libcef_dll_wrapper")
      continue()  # les drapeaux de CEF (/W4 /WX…) : les siens
    endif()
    get_target_property(type ${t} TYPE)
    if(type STREQUAL "INTERFACE_LIBRARY" OR type STREQUAL "UTILITY")
      continue()
    endif()
    get_target_property(opts ${t} COMPILE_OPTIONS)
    if(NOT opts)
      continue()
    endif()
    set(kept "")
    foreach(o IN LISTS opts)
      if(o MATCHES "^-[Wf]" AND NOT o MATCHES "[<>]")
        continue()
      endif()
      list(APPEND kept "${o}")
    endforeach()
    set_property(TARGET ${t} PROPERTY COMPILE_OPTIONS "${kept}")
  endforeach()
endfunction()
