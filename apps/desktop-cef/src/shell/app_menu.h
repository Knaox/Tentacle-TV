#pragma once
// Menus de l'application et raccourcis « d'application » (implémentation par OS :
// src/platform/<os>/shell_menu*). Modèle : le bureau Electron 1.42.0 (apps/desktop-electron/
// src/main/menu.ts) — macOS : menus Application, Édition, Fenêtre ; ailleurs : aucun menu.
//
// Ordre, comme Chromium/Electron : un raccourci ⌘/⌃ va D'ABORD à la page (keydown) ; s'il n'y
// est pas consommé (preventDefault), CEF le rend (CefKeyboardHandler::OnKeyEvent) et il part
// alors aux menus (dispatchUnhandledKey).

#include <cstdint>
#include <functional>

namespace tentacle::platform {

enum class EditCommand { Undo, Redo, Cut, Copy, Paste, PasteAndMatchStyle, Delete, SelectAll };

// Pose la barre de menus ; `edit` exécute les commandes d'édition sur le cadre actif.
void installAppMenu(std::function<void(EditCommand)> edit);
// Vrai tant qu'une page peut recevoir les raccourcis (sinon ils vont droit aux menus).
void setPageReceivesShortcuts(bool on);
// Raccourci non consommé par la page : le rend aux menus. Vrai si un menu l'a pris.
bool dispatchUnhandledKey(int nativeKeyCode, uint32_t cefModifiers);

}  // namespace tentacle::platform
