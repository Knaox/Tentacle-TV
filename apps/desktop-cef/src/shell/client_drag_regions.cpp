// Les régions `app-region: drag` / `no-drag` de la page (axe systeme) : elles deviennent le test
// de clic de la fenêtre SDL (lifecycle/drag_hit_test.h) — sous Electron, Chromium déplace la
// fenêtre depuis ces régions ; en rendu hors écran, c'est à nous de le dire à l'OS.

#include <vector>

#include "lifecycle/drag_hit_test.h"
#include "shell/client.h"

namespace tentacle {

void Client::OnDraggableRegionsChanged(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                                       const std::vector<CefDraggableRegion>& regions) {
  // Le cadre principal seulement : une extension en iframe ne déplace pas la fenêtre (Electron).
  if (frame && !frame->IsMain()) return;
  std::vector<lifecycle::DragRegion> out;
  out.reserve(regions.size());
  for (const auto& r : regions) {
    out.push_back({r.bounds.x, r.bounds.y, r.bounds.width, r.bounds.height, r.draggable != 0});
  }
  lifecycle::setDragRegions(std::move(out));
}

}  // namespace tentacle
