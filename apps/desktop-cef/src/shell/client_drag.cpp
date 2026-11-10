// Ce que la fenêtre native ferait seule et que l'hôte rejoue (navigateur) : la session de
// glisser (src/shell/drag_drop.h) et la bulle d'aide (src/shell/tooltip.h).

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

bool Client::OnTooltip(CefRefPtr<CefBrowser> browser, CefString& text) {
  host_->showTooltip(text.ToString());
  return true;
}

}  // namespace tentacle
