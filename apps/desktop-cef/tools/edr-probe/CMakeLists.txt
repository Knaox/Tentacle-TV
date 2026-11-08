# Sonde EDR externe (vidéo-HDR). Construisible seule ou via add_subdirectory().
cmake_minimum_required(VERSION 3.24)
project(edr_probe LANGUAGES CXX OBJCXX)

add_executable(edr-probe edr_probe.mm)
set_target_properties(edr-probe PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20)
target_compile_options(edr-probe PRIVATE -fobjc-arc -Wall)
target_link_libraries(edr-probe PRIVATE "-framework AppKit")

# Témoin d'étalonnage : une couche EDR minimale (le système accorde-t-il l'EDR maintenant ?).
add_executable(edr-calib edr_calib.mm)
set_target_properties(edr-calib PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20)
target_compile_options(edr-calib PRIVATE -fobjc-arc -Wall)
find_package(SDL3 REQUIRED CONFIG)
set(MPV_PREFIX "$ENV{HOME}/.cache/tentacle-cef/deps/mpv/b5c712f4" CACHE PATH "libmpv")
target_include_directories(edr-calib PRIVATE "${MPV_PREFIX}/include")
target_link_directories(edr-calib PRIVATE "${MPV_PREFIX}/lib")
set_target_properties(edr-calib PROPERTIES BUILD_RPATH "${MPV_PREFIX}/lib")
target_link_libraries(edr-calib PRIVATE mpv SDL3::SDL3 "-framework AppKit" "-framework Metal" "-framework QuartzCore")

# Témoin Vulkan/MoltenVK sans mpv (swapchain HDR10_ST2084) : isole MoltenVK du rendu de mpv.
find_package(Vulkan REQUIRED)
add_executable(edr-calib-vk edr_calib_vk.mm)
set_target_properties(edr-calib-vk PROPERTIES CXX_STANDARD 20 OBJCXX_STANDARD 20)
target_compile_options(edr-calib-vk PRIVATE -fobjc-arc -Wall)
target_link_libraries(edr-calib-vk PRIVATE Vulkan::Vulkan "-framework AppKit" "-framework QuartzCore")
