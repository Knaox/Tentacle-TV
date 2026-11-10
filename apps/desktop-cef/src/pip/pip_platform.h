#pragma once
// La fabrique du PiP de chaque OS : `src/platform/macos/compositor_pip_platform_mac.mm`,
// `src/platform/linux/pip_linux.cpp`, `src/platform/windows/pip_windows.cpp`.
//
// nullptr : pas de PiP sur ce système (ou dans ce montage) — les commandes `pip_*` ne sont pas
// déclarées et la page cache « Réduire », comme Electron hors de ses montages pris en charge.

#include <memory>

#include "pip/pip_ports.h"

struct SDL_Window;

namespace tentacle::pip {

/// `host` : la fenêtre principale (SDL), `nativeHost` sa poignée native (macOS : NSWindow*),
/// `hostStack` son compositeur — sans `canLendVideo()`, pas de PiP.
std::unique_ptr<Platform> createPlatform(SDL_Window* host, void* nativeHost, Compositor* hostStack);

}  // namespace tentacle::pip
