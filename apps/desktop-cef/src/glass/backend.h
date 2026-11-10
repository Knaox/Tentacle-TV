#pragma once
// Ce que le gestionnaire de régions (`regions.h`) demande à AppKit — une interface, pour
// qu'il se vérifie sans fenêtre (`backend.ts` d'Electron) : les tests lui donnent une fausse
// couche native qui consigne chaque geste (`tests/fake_backend.h`).
//
// L'implémentation réelle : `src/platform/macos/glass_backend_mac.mm`.
//
// La propriété des vues : toute vue rendue par `create*` appartient à l'appelant (le +1
// d'`alloc`) jusqu'à `dispose` — qui la retire de son parent PUIS rend cette référence — ou
// `release`, qui ne fait que la rendre. Une poignée n'est plus jamais utilisée ensuite : c'est
// un pointeur, et la réutiliser tuerait le processus.
//
// Fil : le fil principal seulement.

#include <cstdint>
#include <functional>
#include <optional>

#include "glass/geometry.h"
#include "glass/protocol.h"
#include "glass/spring_curve.h"

namespace tentacle::glass {

/// Une vue native, opaque pour le gestionnaire (macOS : `NSView*` retenue).
using ViewHandle = void*;

/// Un groupe : un `NSGlassEffectContainerView` (à nous) et la vue de contenu qui porte ses
/// verres (retenue par le conteneur, jamais rendue à part).
struct GroupHandle {
  ViewHandle container = nullptr;
  ViewHandle content = nullptr;
};

/// De quoi fabriquer un verre. ⚠️ Pas d'alpha : un `NSGlassEffectView` IGNORE le sien, et
/// l'opacité de sa couche (mesuré par Electron, 21/10) ; seul l'alpha de son conteneur
/// l'estompe — d'où les fondus par conteneur (`stage.h`).
struct GlassProps {
  Rect frame;  // AppKit : origine en bas à gauche
  double radius = 0;
  int style = 0;
  std::optional<Rgba> tint;
  std::optional<Appearance> appearance;
};

/// Ce qu'AppKit dit d'un verre posé — l'instantané du banc relit la VRAIE vue.
struct GlassInspection {
  Rect frame;
  double radius = 0;
  int style = 0;
  double alpha = 1;
  bool hidden = false;
  /// À l'écran pendant une animation (couche de présentation) : cadre en vol du verre et
  /// opacité en vol de son conteneur. Pour le banc seulement.
  struct Live {
    Rect frame;
    double containerAlpha = 1;
  };
  std::optional<Live> live;
};

class GlassBackend {
 public:
  virtual ~GlassBackend() = default;
  /// Pose la racine entre la vidéo et la page ; nullptr si la fenêtre ne s'y prête pas.
  virtual ViewHandle createRoot() = 0;
  /// Hauteur de la vue qui porte le verre, en points — l'axe se retourne contre elle.
  virtual double contentHeight() = 0;
  /// Une vue cachée n'est ni dessinée ni composée.
  virtual void setHidden(ViewHandle view, bool hidden) = 0;
  /// Un conteneur posé tout en haut de la racine, à l'alpha donné (0 pour un fondu d'entrée).
  virtual GroupHandle createGroup(ViewHandle root, double spacing, double alpha) = 0;
  virtual void setSpacing(const GroupHandle& group, double spacing) = 0;
  /// Un verre DÉTACHÉ : `placeBelow` le pose dans son groupe.
  virtual ViewHandle createGlass(const GlassProps& props) = 0;
  /// Avec `motion`, le déplacement s'anime côté natif (animateur d'AppKit, Bézier du ressort).
  virtual void setFrame(ViewHandle view, const Rect& frame, const std::optional<NativeMotion>& motion) = 0;
  virtual void setRadius(ViewHandle view, double radius) = 0;
  virtual void setStyle(ViewHandle view, int style) = 0;
  virtual void setTint(ViewHandle view, const std::optional<Rgba>& tint) = 0;
  /// nullopt : l'apparence de la fenêtre.
  virtual void setAppearance(ViewHandle view, std::optional<Appearance> appearance) = 0;
  /// L'alpha d'un CONTENEUR (sur un verre, sans effet) ; `durationMs` > 0 : en fondu, sur la
  /// Bézier `ease` (l'accélération-décélération d'AppKit sinon).
  virtual void setAlpha(ViewHandle view, double alpha, double durationMs, const std::optional<Ease>& ease) = 0;
  /// Pose `view` dans `parent`, juste sous `anchor` — tout en haut si `anchor` est nul.
  virtual void placeBelow(ViewHandle parent, ViewHandle view, ViewHandle anchor) = 0;
  /// Retire de l'écran puis rend la référence.
  virtual void dispose(ViewHandle view) = 0;
  /// Rend la référence SANS toucher au parent — la fenêtre est déjà partie.
  virtual void release(ViewHandle view) = 0;
  virtual GlassInspection inspect(ViewHandle view) = 0;
  /// Les `NSGlassEffectView` réellement posées sous la racine.
  virtual int countGlass(ViewHandle root) = 0;
};

/// Les minuteurs du gestionnaire (en vrai : le fil principal ; en test : à la main).
using TimerId = uint64_t;
class Timers {
 public:
  virtual ~Timers() = default;
  virtual TimerId set(std::function<void()> callback, double ms) = 0;
  virtual void clear(TimerId timer) = 0;
};

}  // namespace tentacle::glass
