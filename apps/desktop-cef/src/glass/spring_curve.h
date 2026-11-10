#pragma once
// Le ressort de la page, rejoué par AppKit — `springCurve.ts` d'Electron, à l'identique.
//
// La page anime ses verres au RESSORT (`apps/web/src/theme/glass/springs.ts`) ; le natif
// reprend la MÊME physique (paramétrage d'Apple : `response`, `dampingFraction`).
//
// Pourquoi une Bézier et pas `CASpringAnimation` (mesuré par Electron le 21/10, macOS 26.6) :
// un `NSGlassEffectView` IGNORE les animations Core Animation posées sur sa couche ; seul
// l'animateur d'AppKit (`NSAnimationContext`) fait suivre la forme du verre, et il ne prend
// qu'une courbe de Bézier rabotée à [0, 1]. On ajuste donc la Bézier la plus proche de la
// réponse du ressort, sur sa coupe à 1 % (291 ms pour `morph`, sous 1 % d'écart de bout en
// bout — la coupe à 0,1 % de la page, 584 ms, s'en écarterait de 3,7 %).

#include <array>
#include <optional>

#include "glass/protocol.h"

namespace tentacle::glass {

/// Les ressorts de la page (`GLASS_SPRINGS`), recopiés.
namespace springs {
inline constexpr SpringSpec kLens{0.32, 0.55};
inline constexpr SpringSpec kMorph{0.42, 0.84};
inline constexpr SpringSpec kSettle{0.26, 1};
}  // namespace springs

/// Coupe : 1 % du trajet, celle des transitions CSS de la page (`SPRING_CSS_EPSILON`).
inline constexpr double kSpringCut = 0.01;

/// Une animation que l'animateur d'AppKit sait jouer : durée et Bézier.
struct NativeMotion {
  double durationMs = 0;
  /// `x1, y1, x2, y2` de `functionWithControlPoints::::`, tous dans [0, 1].
  Ease points{};
  bool operator==(const NativeMotion&) const = default;
};

/// Position à `t` secondes, départ 0, but 1, vitesse nulle — la formule de la page.
double springPosition(const SpringSpec& spring, double t);

/// Dernier instant hors de la coupe, au millième près (`springSettleSeconds` de la page).
double springCutSeconds(const SpringSpec& spring, double epsilon = kSpringCut);

/// La Bézier `points` à l'abscisse `u` : on résout x(s) = u, puis on rend y(s).
double bezierAt(const Ease& points, double u);

/// Durée de coupe et Bézier ajustée d'un ressort — calculées une fois par ressort.
const NativeMotion& springMotion(const SpringSpec& spring);

/// Le mouvement natif d'une région : son ressort, `morph` de la page sinon ; aucun sans transition.
std::optional<NativeMotion> motionOf(const std::optional<double>& transition,
                                     const std::optional<SpringSpec>& spring);

}  // namespace tentacle::glass
