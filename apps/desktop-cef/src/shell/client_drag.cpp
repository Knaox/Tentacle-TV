// Glisser-déposer rendu (navigateur) : CEF demande à l'hôte de jouer la session de glisser que
// la fenêtre native jouerait seule (src/shell/drag_drop.h).

#include <cstdio>
#include <cstdlib>

#include "shell/client.h"

namespace tentacle {

bool Client::StartDragging(CefRefPtr<CefBrowser> browser, CefRefPtr<CefDragData> dragData,
                           DragOperationsMask allowedOps, int x, int y) {
  if (std::getenv("TENTACLE_INPUT_LOG")) {
    std::fprintf(stderr, "[glisser] StartDragging %d,%d ops=%d\n", x, y, int(allowedOps));
  }
  return host_->startDragging(dragData, allowedOps);
}

void Client::UpdateDragCursor(CefRefPtr<CefBrowser> browser, DragOperation operation) {
  host_->updateDragCursor(operation);
}

}  // namespace tentacle
