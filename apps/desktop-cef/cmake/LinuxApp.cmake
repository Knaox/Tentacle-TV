# Linux : un exécutable unique (`tentacle`, qui sert aussi de sous-processus CEF) dans
# <build>/app/, et ce que Chromium cherche À CÔTÉ de lui : libcef.so, ses .pak, icudtl.dat,
# les instantanés V8, locales/, SwiftShader. Des LIENS vers la distribution CEF (posés à la
# configuration) : rien de copié, le build reste léger. Le paquet de distribution (AppImage,
# rpm…) est un lot suivant.

function(tentacle_add_linux_app)
  cmake_parse_arguments(A "" "NAME" "SOURCES;RESOURCES" ${ARGN})
  set(app_dir "${CMAKE_BINARY_DIR}/app")
  file(MAKE_DIRECTORY "${app_dir}/resources")

  add_executable(tentacle_app ${A_SOURCES})
  set_target_properties(tentacle_app PROPERTIES
    OUTPUT_NAME "${A_NAME}"
    RUNTIME_OUTPUT_DIRECTORY "${app_dir}"
    # libcef.so à côté de l'exécutable ; libmpv et SDL3 du cache (développement).
    BUILD_RPATH "\$ORIGIN;${TENTACLE_MPV_LIBDIR}")
  target_link_libraries(tentacle_app PRIVATE tentacle_shell)

  # La distribution CEF, lien par lien (fichiers ET dossiers : locales/).
  foreach(dir "${CEF_ROOT}/Release" "${CEF_ROOT}/Resources")
    file(GLOB entries RELATIVE "${dir}" "${dir}/*")
    foreach(e ${entries})
      if(NOT EXISTS "${app_dir}/${e}")
        file(CREATE_LINK "${dir}/${e}" "${app_dir}/${e}" SYMBOLIC)
      endif()
    endforeach()
  endforeach()
  # Le Vulkan de CEF (libvulkan.so.1) reste dans sa distribution : sous RUNPATH, il ne
  # s'imposerait qu'à l'exécutable, mais mpv doit charger celui du système (pilotes).
  if(IS_SYMLINK "${app_dir}/libvulkan.so.1")
    file(REMOVE "${app_dir}/libvulkan.so.1")
  endif()

  foreach(r ${A_RESOURCES})
    get_filename_component(n "${r}" NAME)
    configure_file("${r}" "${app_dir}/resources/${n}" COPYONLY)
  endforeach()
endfunction()
