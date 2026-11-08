// Ébauche windows (non construite sur ce Mac) : ce que l'application attend de l'OS.
// À compléter : saisie native (keycodes), ressources installées, focus.

#include "app/platform_app.h"
#include "shell/keymap.h"
#include "shell/keymap_common.h"

namespace tentacle::platform {

void initApplication() {}
void* nativeWindow(SDL_Window* window) {
  return SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr);
}
void prepareWindow(SDL_Window* window, bool activate) {
  if (activate) SDL_RaiseWindow(window);
}
std::string resourceUrl(const char* name) { return "about:blank"; }

}  // namespace tentacle::platform

namespace tentacle::keymap {

NativeKey translate(const SDL_KeyboardEvent& ev) {
  NativeKey k;
  // Windows : scancode (lParam bits 16-23) ; à affiner (bit étendu)
  k.nativeCode = int(ev.raw);
  k.windowsCode = windowsKeyCode(SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false));
  k.unmodified = char16_t(SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false) & 0xFFFF);
  k.character = char16_t(SDL_GetKeyFromScancode(ev.scancode, ev.mod, false) & 0xFFFF);
  return k;
}

}  // namespace tentacle::keymap

#include "shell/native_input.h"

namespace tentacle::platform {

bool installNativeWheel(SDL_Window*, std::function<void(const NativeWheel&)>) { return false; }
void uninstallNativeWheel() {}
std::string injectNative(SDL_Window*, const Json&) { return "non pris en charge"; }

}  // namespace tentacle::platform

#include "shell/app_menu.h"

namespace tentacle::platform {

// Aucun menu hors macOS (Electron : Menu.setApplicationMenu(null)) ; les raccourcis
// d'édition sont traités par le moteur de rendu lui-même.
void installAppMenu(std::function<void(EditCommand)>) {}
void setPageReceivesShortcuts(bool) {}
bool dispatchUnhandledKey(int, uint32_t) { return false; }

}  // namespace tentacle::platform

#include "shell/frame_clock.h"

namespace tentacle::platform {

// Minuteur BeginFrame interne de CEF (à remplacer par la vsync de l'OS si besoin).
bool frameClockSupported() { return false; }
bool startFrameClock(SDL_Window*, std::function<void()>) { return false; }
void stopFrameClock() {}
void setFrameClockMode(FrameClockMode) {}

}  // namespace tentacle::platform

namespace tentacle::platform {
// À faire avec le portage : langues du système (LANGUAGE/LANG, GetUserPreferredUILanguages).
std::string acceptLanguages() { return ""; }
}  // namespace tentacle::platform
