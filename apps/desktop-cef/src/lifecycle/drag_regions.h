#pragma once
// Les régions `app-region: drag` / `no-drag` de la page (CefDragHandler::OnDraggableRegionsChanged)
// et la question que pose le test de clic de la fenêtre : ce point déplace-t-il la fenêtre ?
//
// Règle de Chromium (`DraggableRegionsToSkRegion`, celle d'Electron) : les régions s'appliquent
// DANS L'ORDRE — une région `drag` s'ajoute, une `no-drag` se retranche. Un point est donc
// déplaçable si la DERNIÈRE région qui le contient est `drag`.

#include <vector>

namespace tentacle::lifecycle {

/// Un rectangle de la page, en points (DIP), origine en haut à gauche.
struct DragRegion {
  int x = 0, y = 0, width = 0, height = 0;
  bool draggable = false;
};

bool isDraggable(const std::vector<DragRegion>& regions, double x, double y);

}  // namespace tentacle::lifecycle
