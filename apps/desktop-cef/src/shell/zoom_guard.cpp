#include "shell/zoom_guard.h"

#include <cstdio>

#include "shell/main_thread.h"

namespace tentacle {

void guardZoom(const SDL_Event& e, CefRefPtr<CefBrowser> browser) {
  if (!browser || e.type != SDL_EVENT_MOUSE_WHEEL || !(SDL_GetModState() & SDL_KMOD_CTRL)) return;
  // Le zoom suit la réponse du rendu à l'évènement (non consommé) : on regarde juste après.
  postToMainDelayed([browser] {
    auto host = browser->GetHost();
    if (host->GetZoomLevel() != 0.0) {
      std::fprintf(stderr, "[zoom] Ctrl+molette : niveau %.2f remis à 0 (comme Electron)\n",
                   host->GetZoomLevel());
      host->SetZoomLevel(0.0);
    }
  }, 120);
}

}  // namespace tentacle
