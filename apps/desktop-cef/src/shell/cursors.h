#pragma once
// Les curseurs de la page, comme Chromium les montre dans une vraie fenêtre (Electron) :
//   - formes que SDL connaît (flèche, main, texte, redimensionnements…) → curseur système SDL ;
//   - formes que SDL n'a pas (grab/grabbing, zoom-in/out, help, copy, alias, cell, menu…) →
//     l'image du curseur NATIF que CEF fournit (macOS NSCursor, Windows HCURSOR), recopiée dans
//     un curseur SDL couleur ; Linux (pas de curseur natif en rendu hors écran) : la forme SDL
//     la plus proche ;
//   - `cursor: url(…)` (CT_CUSTOM) → l'image donnée par CEF, à sa densité ;
//   - pendant un glisser interne : le curseur de l'opération (copie, lien, refus).
// SDL reste le seul à poser le curseur (il le repose lui-même à l'entrée dans la fenêtre).

#include <SDL3/SDL.h>

#include <map>

#include "include/cef_render_handler.h"

namespace tentacle {

namespace platform {
/// Image d'un curseur natif fourni par CEF, ou nullptr. Surface 1× (variante haute densité
/// attachée par SDL_AddSurfaceAlternateImage) ; `hotX`, `hotY` en points.
SDL_Surface* nativeCursorImage(CefCursorHandle handle, int& hotX, int& hotY);
/// Image du curseur d'un glisser pour cette opération, ou nullptr (forme SDL de repli).
SDL_Surface* dragCursorImage(cef_drag_operations_mask_t operation, int& hotX, int& hotY);
}  // namespace platform

class CursorSet {
 public:
  ~CursorSet();
  /// Curseur pour un changement annoncé par CEF ; nullptr pour CT_NONE (curseur caché).
  SDL_Cursor* forPage(cef_cursor_type_t type, CefCursorHandle native, const CefCursorInfo& custom);
  /// Curseur d'un glisser interne selon l'opération acceptée par la cible.
  SDL_Cursor* forDrag(cef_drag_operations_mask_t operation);

 private:
  SDL_Cursor* system(SDL_SystemCursor c);
  std::map<int, SDL_Cursor*> system_;   // par SDL_SystemCursor
  std::map<int, SDL_Cursor*> native_;   // par cef_cursor_type_t (formes sans équivalent SDL)
  std::map<int, SDL_Cursor*> drag_;     // par opération
  SDL_Cursor* custom_ = nullptr;        // le dernier `cursor: url(…)`
  SDL_Cursor* oldCustom_ = nullptr;     // l'avant-dernier (peut-être encore affiché)
};

}  // namespace tentacle
