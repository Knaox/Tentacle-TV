// Ce que le socle attend de Linux hors fenêtre : traduction des touches pour CEF, saisie
// native (SDL3 suffit), menu (aucun, comme Electron), horloge d'images (celle de CEF).

#include "platform/linux/linux_window.h"
#include "shell/keymap.h"
#include "shell/keymap_common.h"

namespace tentacle::keymap {
namespace {

// Caractère porté par une touche (keycode SDL = point de code Unicode pour les touches
// imprimables ; les touches sans caractère ont le bit SDLK_SCANCODE_MASK).
char16_t charOf(SDL_Keycode k) {
  if (k & SDLK_SCANCODE_MASK) return 0;
  if (k == SDLK_KP_ENTER) return u'\r';
  return k <= 0xFFFF ? char16_t(k) : 0;
}

}  // namespace

NativeKey translate(const SDL_KeyboardEvent& ev) {
  NativeKey k;
  // CEF Linux attend le keycode XKB (= evdev + 8), d'où il tire `code` (KeyA, Digit1…).
  // SDL3 donne en `raw` le keycode X11 sous X11 (déjà +8) et le code evdev sous Wayland.
  k.nativeCode = int(ev.raw) + (platform::sdlIsWayland() ? 8 : 0);
  const SDL_Keycode base = SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false);
  k.windowsCode = windowsKeyCode(base);
  // Pavé numérique : SDL3 a ses propres keycodes, que windowsKeyCode ne connaît pas.
  if (k.windowsCode == 0 && ev.scancode >= SDL_SCANCODE_KP_1 && ev.scancode <= SDL_SCANCODE_KP_0) {
    k.windowsCode = ev.scancode == SDL_SCANCODE_KP_0 ? 0x60 : 0x61 + (ev.scancode - SDL_SCANCODE_KP_1);
  }
  k.unmodified = charOf(base);
  k.character = charOf(SDL_GetKeyFromScancode(ev.scancode, ev.mod, false));
  return k;
}

}  // namespace tentacle::keymap

#include "shell/native_input.h"

namespace tentacle::platform {

// SDL3 donne déjà la molette en crans fractionnaires (Wayland axis_value120, XInput2) :
// le socle la convertit (input.cpp). Pas de moniteur natif comme sous macOS.
bool installNativeWheel(SDL_Window*, std::function<void(const NativeWheel&)>) { return false; }
void uninstallNativeWheel() {}
std::string injectNative(SDL_Window*, const Json&) { return "non pris en charge sous Linux"; }

}  // namespace tentacle::platform

#include "shell/app_menu.h"

namespace tentacle::platform {

// Aucun menu hors macOS (Electron : Menu.setApplicationMenu(null)) ; les raccourcis
// d'édition (Ctrl+C, Ctrl+V…) sont traités par le moteur de rendu lui-même.
void installAppMenu(std::function<void(EditCommand)>) {}
void setPageReceivesShortcuts(bool) {}
bool dispatchUnhandledKey(int, uint32_t) { return false; }

}  // namespace tentacle::platform

#include "shell/frame_clock.h"

namespace tentacle::platform {

// Minuteur BeginFrame interne de CEF, à la fréquence de l'écran (windowless_frame_rate).
bool frameClockSupported() { return false; }
bool startFrameClock(SDL_Window*, std::function<void()>) { return false; }
void stopFrameClock() {}
void setFrameClockMode(FrameClockMode) {}

}  // namespace tentacle::platform
