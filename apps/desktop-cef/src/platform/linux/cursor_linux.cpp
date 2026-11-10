// Curseurs Linux : en rendu hors écran, CEF ne fournit pas de curseur natif sous Ozone
// (X11 comme Wayland) ; les formes absentes de SDL prennent la plus proche (shell/cursors.cpp).
#include "shell/cursors.h"

namespace tentacle::platform {

SDL_Surface* nativeCursorImage(CefCursorHandle, int&, int&) { return nullptr; }
SDL_Surface* dragCursorImage(cef_drag_operations_mask_t, int&, int&) { return nullptr; }

}  // namespace tentacle::platform
