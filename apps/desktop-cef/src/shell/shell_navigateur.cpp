// Les méthodes de Shell propres à l'axe navigateur : curseurs (cursors.h) et plein écran HTML.

#include <cstdio>

#include "shell/shell.h"

namespace tentacle {

// CefCursorHandle{} : un pointeur sous macOS, un entier (Cursor X11) sous Linux.
void Shell::setCursor(cef_cursor_type_t type) { setCursorFull(type, CefCursorHandle{}, CefCursorInfo()); }

// navigateur : la forme de la page, ou celle du glisser en cours (src/shell/cursors.h).
void Shell::setCursorFull(cef_cursor_type_t type, CefCursorHandle native,
                          const CefCursorInfo& custom) {
  lastCursor_ = int(type);
  SDL_Cursor* c = cursors_.forPage(type, native, custom);
  static const bool trace = SDL_getenv("TENTACLE_INPUT_LOG") != nullptr;
  if (trace) {
    std::fprintf(stderr, "[curseur] type %d natif %s → %p\n", int(type), native ? "oui" : "non",
                 static_cast<void*>(c));
  }
  if (dragDrop_->internalActive()) return;  // le curseur du glisser l'emporte
  applyCursor(c);
}

void Shell::applyCursor(SDL_Cursor* c) {
  if (!c) {
    SDL_HideCursor();
    cursorHidden_ = true;
    return;
  }
  if (cursorHidden_) {
    SDL_ShowCursor();
    cursorHidden_ = false;
  }
  SDL_SetCursor(c);
  pageCursor_ = c;
}

// Electron REFUSE le plein écran HTML : `requestFullscreen` passe par sa permission
// « fullscreen », refusée comme toute permission web (`security.ts` ; le front le sait :
// `useTrailerFullscreen`, qui passe par `toggle_fullscreen`). CEF ne demande rien : la page (ou
// le lecteur YouTube des bandes-annonces, `allowfullscreen`) entrerait en plein écran. Il en
// ressort aussitôt ; la fenêtre ne bouge pas.
void Shell::onDocumentFullscreen(bool fullscreen) {
  documentFullscreen_ = false;
  if (!fullscreen || !browser_) return;
  std::fprintf(stderr, "[nav] plein écran HTML refusé (comme Electron)\n");
  browser_->GetHost()->ExitFullscreen(true);
}

}  // namespace tentacle
