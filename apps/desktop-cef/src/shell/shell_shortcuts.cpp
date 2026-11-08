// Raccourcis d'application du Shell, calqués sur le bureau Electron 1.42.0 :
//   - F11 bascule le plein écran AVANT la page (fullscreenSync.ts, installF11) : elle sort du
//     plein écran de la fenêtre ET de celui du document, et n'entre que si aucun n'est actif ;
//   - ⌘/⌃+touche non consommée par la page → menus de l'app (shell/app_menu.h) ;
//   - macOS : ⌘+flèches et ⌘+⌫ dans un champ. Chromium les reçoit d'AppKit sous forme de
//     commandes d'édition (moveToBeginningOfLine:…, StandardKeyBinding.dict) ; en hors écran
//     personne ne les produit (Blink ne connaît d'office que ⌥+flèches) : on les rejoue par
//     Selection.modify, seulement si la page n'a pas consommé la touche.

#include <cstdio>
#include <string>

#include "shell/app_menu.h"
#include "shell/shell.h"

namespace tentacle {

bool Shell::interceptKey(const SDL_KeyboardEvent& k) {
  if (k.scancode != SDL_SCANCODE_F11) return false;
  // Electron filtre sur input.key === "F11", modificateurs compris ; ni keydown ni keyup
  // n'atteignent la page.
  if (k.down && !k.repeat) toggleFullscreenF11();
  return true;
}

void Shell::toggleFullscreenF11() {
  const bool window = (SDL_GetWindowFlags(window_) & SDL_WINDOW_FULLSCREEN) != 0;
  std::fprintf(stderr, "[shell] F11 — fenêtre=%d document=%d\n", window, documentFullscreen_);
  if (documentFullscreen_ && browser_) {
    browser_->GetMainFrame()->ExecuteJavaScript(
        "document.fullscreenElement && document.exitFullscreen()", "", 0);
  }
  if (window || documentFullscreen_) {
    if (window) SDL_SetWindowFullscreen(window_, false);
  } else {
    SDL_SetWindowFullscreen(window_, true);
  }
}

namespace {

#ifdef __APPLE__
// ⌘+touche d'édition → script sur la sélection du champ actif (vide si aucune).
const char* commandEdit(int kVK, bool shift) {
  const bool sel = shift;
  switch (kVK) {
    case 0x7B: return sel ? "s.modify('extend','backward','lineboundary')" : "s.modify('move','backward','lineboundary')";
    case 0x7C: return sel ? "s.modify('extend','forward','lineboundary')" : "s.modify('move','forward','lineboundary')";
    case 0x7E: return sel ? "s.modify('extend','backward','documentboundary')" : "s.modify('move','backward','documentboundary')";
    case 0x7D: return sel ? "s.modify('extend','forward','documentboundary')" : "s.modify('move','forward','documentboundary')";
    case 0x33: return "s.isCollapsed&&s.modify('extend','backward','lineboundary');document.execCommand('delete')";
    case 0x75: return "s.isCollapsed&&s.modify('extend','forward','lineboundary');document.execCommand('forwardDelete')";
    default: return nullptr;
  }
}
#endif

}  // namespace

bool Shell::onUnhandledKey(const CefKeyEvent& event) {
  if (event.type != KEYEVENT_RAWKEYDOWN) return false;
#ifdef __APPLE__
  const uint32_t mods = event.modifiers & (EVENTFLAG_COMMAND_DOWN | EVENTFLAG_CONTROL_DOWN |
                                           EVENTFLAG_ALT_DOWN);
  if (mods == EVENTFLAG_COMMAND_DOWN && browser_) {
    if (const char* js = commandEdit(event.native_key_code, event.modifiers & EVENTFLAG_SHIFT_DOWN)) {
      auto frame = browser_->GetFocusedFrame();
      if (!frame) frame = browser_->GetMainFrame();
      frame->ExecuteJavaScript(std::string("(()=>{const s=getSelection();if(s){") + js + "}})()",
                               "", 0);
      return true;
    }
  }
#endif
  return platform::dispatchUnhandledKey(event.native_key_code, event.modifiers);
}

}  // namespace tentacle
