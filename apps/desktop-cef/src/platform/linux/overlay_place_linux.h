#pragma once
// Où poser la bulle d'aide dans la fenêtre — règle pure (testée sans affichage). La bulle est
// dessinée DANS la fenêtre (overlay_linux.h) : elle n'en sort jamais.

#include <algorithm>

namespace tentacle::platform {

struct OverlayPlace {
  int x = 0, y = 0;
};

/// Tout en pixels de la fenêtre. Sous le curseur de `below` ; si elle dépasserait le bas, AU-DESSUS
/// du curseur (de `above`) ; toujours ramenée dans la fenêtre, à `margin` du bord quand elle tient.
inline OverlayPlace placeTooltip(int cursorX, int cursorY, int width, int height, int windowWidth,
                                 int windowHeight, int below, int above, int margin) {
  OverlayPlace p;
  p.y = cursorY + below;
  if (p.y + height + margin > windowHeight) p.y = cursorY - above - height;
  p.x = cursorX;
  p.x = std::min(p.x, windowWidth - margin - width);
  p.y = std::min(p.y, windowHeight - margin - height);
  // Une bulle plus grande que la fenêtre : calée en haut à gauche, coupée à droite et en bas.
  p.x = std::max(p.x, std::min(margin, std::max(0, windowWidth - width)));
  p.y = std::max(p.y, std::min(margin, std::max(0, windowHeight - height)));
  return p;
}

}  // namespace tentacle::platform
