# Assemble le paquet macOS : <NAME>.app avec le framework CEF et ses 5 helpers.
#
# Pourquoi des helpers séparés (et pas l'exécutable principal en sous-processus comme la
# référence) : Chromium cherche « <NAME> Helper (GPU|Renderer|Plugin|Alerts).app » dans
# Contents/Frameworks ; chaque type a son Info.plist (LSUIElement, identifiant) et pourra
# porter ses propres entitlements. Le helper ne lie ni SDL ni le compositeur : il démarre vite.
# Un seul binaire helper est construit puis copié sous les 5 noms.

function(tentacle_add_mac_app)
  cmake_parse_arguments(A "" "NAME;BUNDLE_ID" "MAIN_SOURCES;HELPER_SOURCES;RESOURCES" ${ARGN})
  set(app_dir "${CMAKE_BINARY_DIR}/${A_NAME}.app")
  set(fw_dir "${app_dir}/Contents/Frameworks")

  # Exécutable principal.
  add_executable(tentacle_app MACOSX_BUNDLE ${A_MAIN_SOURCES})
  set_target_properties(tentacle_app PROPERTIES
    OUTPUT_NAME "${A_NAME}"
    MACOSX_BUNDLE_INFO_PLIST "${CMAKE_SOURCE_DIR}/cmake/Info.plist.in"
    MACOSX_BUNDLE_GUI_IDENTIFIER "${A_BUNDLE_ID}"
    MACOSX_BUNDLE_BUNDLE_NAME "${A_NAME}")
  target_link_libraries(tentacle_app PRIVATE tentacle_shell)
  target_compile_options(tentacle_app PRIVATE -fobjc-arc)

  # Binaire helper unique.
  add_executable(tentacle_helper ${A_HELPER_SOURCES})
  target_link_libraries(tentacle_helper PRIVATE tentacle_renderer "-framework Cocoa")
  target_compile_options(tentacle_helper PRIVATE -fobjc-arc)
  # Framework lié (TentacleCef.cmake) : son nom d'installation vise l'exécutable principal
  # (@executable_path/../Frameworks) ; le helper, lui, vit trois niveaux plus bas, dans
  # Contents/Frameworks/<nom> Helper.app/Contents/MacOS.
  add_custom_command(TARGET tentacle_helper POST_BUILD
    COMMAND install_name_tool -change
      "@executable_path/../Frameworks/Chromium Embedded Framework.framework/Chromium Embedded Framework"
      "@executable_path/../../../Chromium Embedded Framework.framework/Chromium Embedded Framework"
      "$<TARGET_FILE:tentacle_helper>"
    COMMENT "Helper : chemin du framework CEF relatif à Contents/Frameworks"
    VERBATIM)
  add_dependencies(tentacle_app tentacle_helper)

  # Framework CEF : copie par clone APFS (cp -c, quasi instantané), une fois par version.
  set(fw_src "${TENTACLE_CEF_RELEASE_DIR}/Chromium Embedded Framework.framework")
  set(fw_dst "${fw_dir}/Chromium Embedded Framework.framework")
  set(fw_stamp "${CMAKE_BINARY_DIR}/cef_framework.stamp")
  # En --dist, la copie est élaguée de ce que CEF classe optionnel et qui ne sert pas.
  set(trim_cmds "")
  if(TENTACLE_DIST)
    set(trim_cmds COMMAND "${CMAKE_SOURCE_DIR}/scripts/deps/trim-cef.sh" "${fw_dst}/Versions/A"
                          "${CEF_ROOT}")
  endif()
  add_custom_command(OUTPUT "${fw_stamp}"
    COMMAND rm -rf "${fw_dst}"
    COMMAND mkdir -p "${fw_dst}/Versions"
    COMMAND cp -cR "${fw_src}" "${fw_dst}/Versions/A"
    ${trim_cmds}
    COMMAND ln -sfh A "${fw_dst}/Versions/Current"
    COMMAND ln -sfh "Versions/Current/Chromium Embedded Framework" "${fw_dst}/Chromium Embedded Framework"
    COMMAND ln -sfh Versions/Current/Libraries "${fw_dst}/Libraries"
    COMMAND ln -sfh Versions/Current/Resources "${fw_dst}/Resources"
    COMMAND ${CMAKE_COMMAND} -E touch "${fw_stamp}"
    DEPENDS "${fw_src}/Chromium Embedded Framework"
    COMMENT "Copie du framework CEF dans le paquet"
    VERBATIM)
  add_custom_target(tentacle_cef_framework DEPENDS "${fw_stamp}")
  add_dependencies(tentacle_app tentacle_cef_framework)

  # Helpers : un Info.plist par variante (suffixes fournis par cef_variables.cmake).
  set(helper_cmds "")
  foreach(suffix_def ${CEF_HELPER_APP_SUFFIXES})
    string(REPLACE ":" ";" parts "${suffix_def}")
    list(GET parts 0 name_suffix)
    # Le helper « Alerts » ne sert qu'aux notifications système de l'API Notification du Web,
    # que le front n'appelle pas (Electron n'en livre pas non plus) : absent en --dist.
    if(TENTACLE_DIST AND name_suffix STREQUAL " (Alerts)")
      continue()
    endif()
    list(GET parts 2 plist_suffix)
    set(HELPER_NAME "${A_NAME} Helper${name_suffix}")
    set(HELPER_BUNDLE_ID "${A_BUNDLE_ID}.helper${plist_suffix}")
    set(plist "${CMAKE_BINARY_DIR}/helper-plists/${HELPER_NAME}.plist")
    configure_file("${CMAKE_SOURCE_DIR}/cmake/HelperInfo.plist.in" "${plist}" @ONLY)
    set(h "${fw_dir}/${HELPER_NAME}.app/Contents")
    list(APPEND helper_cmds
      COMMAND mkdir -p "${h}/MacOS"
      COMMAND cp -f "$<TARGET_FILE:tentacle_helper>" "${h}/MacOS/${HELPER_NAME}"
      COMMAND cp -f "${plist}" "${h}/Info.plist")
  endforeach()

  set(res_cmds "")
  foreach(r ${A_RESOURCES})
    list(APPEND res_cmds COMMAND cp -f "${r}" "${app_dir}/Contents/Resources/")
  endforeach()

  # Paquet de distribution : libmpv, FFmpeg, SDL3, MoltenVK… copiés dans Frameworks.
  set(dist_cmds "")
  if(TENTACLE_DIST)
    set(deps "${CMAKE_SOURCE_DIR}/scripts/deps")
    # Le helper est sorti de ses symboles une fois, avant d'être copié sous ses 5 noms.
    add_custom_command(TARGET tentacle_helper POST_BUILD
      COMMAND "${deps}/strip-symbols.sh" "${CMAKE_BINARY_DIR}/symbols" "$<TARGET_FILE:tentacle_helper>"
      VERBATIM)
    # libmpv est liée par -L/-lmpv : sans cette dépendance, refaire deps/paquet (correctif
    # mpv, FFmpeg) ne relie pas l'app, et l'embarquement ci-dessous garde l'ancienne copie.
    # Idem pour les scripts d'assemblage : un correctif doit se rejouer au build suivant.
    set_property(TARGET tentacle_app APPEND PROPERTY LINK_DEPENDS "${TENTACLE_MPV_LIBDIR}/libmpv.2.dylib"
      "${deps}/embed-dylibs.sh" "${deps}/strip-symbols.sh")
    list(APPEND dist_cmds
      COMMAND "${deps}/embed-dylibs.sh" "${app_dir}" "$<TARGET_FILE:tentacle_app>" "${TENTACLE_MPV_LIBDIR}"
      COMMAND find "${fw_dir}" -maxdepth 1 -name "*.dylib" -exec
              "${deps}/strip-symbols.sh" "${CMAKE_BINARY_DIR}/symbols" {} +
      COMMAND "${deps}/strip-symbols.sh" "${CMAKE_BINARY_DIR}/symbols" "$<TARGET_FILE:tentacle_app>"
      # Licences : celles de la chaîne de lecture (paquet-deps.sh : libsodium et nlohmann/json
      # compris), les crédits de Chromium, et celles de Tentacle TV (AGPL §5, permissions).
      COMMAND mkdir -p "${app_dir}/Contents/Resources/licenses"
      COMMAND cp -R "${TENTACLE_MPV_LIBDIR}/../licenses/." "${app_dir}/Contents/Resources/licenses/"
      COMMAND cp "${CMAKE_SOURCE_DIR}/../../LICENSE" "${app_dir}/Contents/Resources/licenses/LICENSE"
      COMMAND cp "${CMAKE_SOURCE_DIR}/../../LICENSE-EXCEPTIONS" "${app_dir}/Contents/Resources/licenses/LICENSE-EXCEPTIONS"
      COMMAND cp "${CMAKE_SOURCE_DIR}/THIRD-PARTY-LICENSES.md" "${app_dir}/Contents/Resources/licenses/THIRD-PARTY-LICENSES.md"
      COMMAND cp "${CEF_ROOT}/CREDITS.html" "${app_dir}/Contents/Resources/licenses/CREDITS-Chromium.html"
      COMMAND cp "${CEF_ROOT}/LICENSE.txt" "${app_dir}/Contents/Resources/licenses/CEF.txt"
      COMMAND find "${fw_dir}" -maxdepth 1 -name "*.dylib" -exec codesign --force --sign - --timestamp=none {} +)
  endif()

  # Signature ad hoc du paquet entier (helpers puis app) : Chromium vérifie la cohérence
  # des signatures pour son rendez-vous de ports Mach entre processus.
  add_custom_command(TARGET tentacle_app POST_BUILD
    ${helper_cmds}
    COMMAND mkdir -p "${app_dir}/Contents/Resources"
    ${res_cmds}
    ${dist_cmds}
    COMMAND codesign --force --sign - --timestamp=none "${fw_dst}"
    COMMAND sh -c "for h in \"$0\"/*Helper*.app; do codesign --force --sign - --timestamp=none \"$h\"; done" "${fw_dir}"
    COMMAND codesign --force --sign - --timestamp=none "${app_dir}"
    COMMENT "Assemblage des helpers CEF et signature ad hoc"
    VERBATIM)
endfunction()
