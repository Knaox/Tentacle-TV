// Windows : ce que le socle demande à l'OS et qui n'a rien à faire ici (comme Electron).
// Application, saisie, pompe : app_windows.cpp, keymap_windows.cpp, native_input_windows.cpp,
// message_pump_windows.cpp.

#include "shell/app_menu.h"
#include "shell/frame_clock.h"

namespace tentacle::platform {

// Aucun menu hors macOS (Electron : Menu.setApplicationMenu(null)) ; Ctrl+C/V/X/A/Z sont
// traités par le moteur de rendu lui-même, comme dans Chrome sous Windows.
void installAppMenu(std::function<void(EditCommand)>) {}
void setPageReceivesShortcuts(bool) {}
bool dispatchUnhandledKey(int, uint32_t) { return false; }

// Horloge d'images : le minuteur BeginFrame interne de CEF, à la fréquence de l'écran
// (windowless_frame_rate, suivie par Shell::syncFrameRate). Le défaut que l'horloge native
// corrige sur macOS (retour à 60 Hz après SetWindowlessFrameRate) n'a pas été constaté ici ;
// une horloge par DwmFlush viendra si la recette Windows le montre (docs/A-TESTER-WINDOWS.md).
bool frameClockSupported() { return false; }
bool startFrameClock(SDL_Window*, std::function<void()>) { return false; }
void stopFrameClock() {}
void setFrameClockMode(FrameClockMode) {}

}  // namespace tentacle::platform
