#pragma once
// Ce que le verre natif calcule SANS AppKit : rectangles, teintes, styles, ordre
// d'empilement — `geometry.ts` d'Electron, à l'identique. Vérifiable sans fenêtre.

#include <optional>
#include <string>
#include <vector>

#include "glass/protocol.h"

namespace tentacle::glass {

/// Un rectangle en points. Selon l'appelant, origine en HAUT à gauche (la page) ou en BAS à
/// gauche (AppKit) — les noms des fonctions le disent.
struct Rect {
  double x = 0, y = 0, width = 0, height = 0;
  bool operator==(const Rect&) const = default;
};

/// Composantes sRGB, de 0 à 1.
struct Rgba {
  double r = 0, g = 0, b = 0, a = 1;
  bool operator==(const Rgba&) const = default;
};

/// Des px CSS aux points de la fenêtre : le zoom de la page, rien d'autre (la vue web couvre
/// toute la vue de contenu : le bandeau des feux est peint par la page).
Rect toPoints(const Region& region, double zoom);

/// Le rayon en points, jamais plus que la demi-hauteur ni la demi-largeur.
double toPointRadius(const Region& region, double zoom);

/// Retourne l'axe vertical : AppKit compte depuis le BAS de la vue qui porte le verre.
Rect toAppKitFrame(const Rect& rect, double containerHeight);

/// Deux rectangles au centième de point près : en deçà, rien à écrire.
bool sameRect(const Rect& a, const Rect& b);

/// `#RRGGBB` ou `#RRGGBBAA` ; nullopt pour toute autre forme (et pour l'absence de teinte).
std::optional<Rgba> parseTint(const std::optional<std::string>& hex);

/// Le style d'AppKit (`NSGlassEffectViewStyle`) : `Regular` (0) et `Clear` (1) seulement.
/// `tinted` et `prominent` sont le verre ordinaire AVEC sa teinte. Jamais une variante non
/// publique : le build du Mac App Store reçoit exactement ce code.
int nativeStyle(Level level);

/// Un élément empilable : sa profondeur, et son rang d'arrivée pour départager.
struct Stackable {
  std::string key;
  double z = 0;
  long seq = 0;
};

/// La clé de l'élément qui doit se trouver JUSTE AU-DESSUS de `key`, ou nullopt s'il va tout en
/// haut (ou s'il est inconnu). À profondeur égale, le dernier venu passe au-dessus — comme deux
/// frères en CSS.
std::optional<std::string> stackAnchor(std::vector<Stackable> items, const std::string& key);

/// Un point au centre du cadre : d'où un verre naît, où il fond.
Rect centerOf(const Rect& frame);

}  // namespace tentacle::glass
