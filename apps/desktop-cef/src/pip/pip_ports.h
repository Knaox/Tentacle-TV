#pragma once
// Ce que le PiP demande au reste de l'app — l'interface que chaque OS implémente.
//
// Le PiP portable (`pip_session`, `pip_controller`) ne connaît ni CEF, ni SDL, ni AppKit : il
// parle à ces portes. macOS les implémente dans `src/platform/macos/compositor_pip*` ; Linux
// et Windows dans `src/platform/<os>/pip_<os>.cpp` (voir docs/INTERFACES.md, « PiP »).
//
// Coordonnées : POINTS logiques, origine en haut à gauche de l'écran principal (celle
// d'Electron et de SDL3). Tout appel : fil principal.

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

#include "pip/rules/pip_types.h"

namespace tentacle {
class Compositor;
class VideoSurface;
}  // namespace tentacle

namespace tentacle::pip {

/// L'horloge : une minuterie répétée (rend de quoi l'arrêter) et l'heure en millisecondes.
class Ticker {
 public:
  virtual ~Ticker() = default;
  virtual std::function<void()> every(double intervalMs, std::function<void()> tick) = 0;
  virtual double nowMs() = 0;
};

/// Le bureau autour du PiP : écrans, curseur, fenêtre principale, réglages du système.
class Desktop {
 public:
  virtual ~Desktop() = default;
  virtual Point cursor() = 0;
  /// Zone utile (sans barre de menus ni Dock) de l'écran le plus proche du point.
  virtual Box workAreaNearest(Point point) = 0;
  /// Zone utile et cadre entier de l'écran qui recouvre le plus `box`.
  virtual Box workAreaMatching(const Box& box) = 0;
  virtual Box displayBoundsMatching(const Box& box) = 0;
  /// La zone de contenu de la fenêtre principale, et son cadre entier.
  virtual Box hostContentBounds() = 0;
  virtual Box hostBounds() = 0;
  /// Le bandeau que la page dessine en haut du lecteur (barre de titre intégrée), 0 sans.
  virtual double bannerInset() = 0;
  /// « Réduire les animations » : le PiP saute alors à sa place.
  virtual bool reducedMotion() = 0;
};

/// Ce que la fenêtre PiP native signale au PiP portable.
struct WindowEvents {
  /// La main a fini de la redimensionner par les bords du système.
  std::function<void()> resizedByUser;
  /// Le système propose un nouveau cadre (bord tiré) : rend le cadre accepté.
  std::function<Box(const Box& current, const Box& proposed)> willResize;
  /// La fenêtre principale a bougé ou changé de taille (le PiP ancré la suit).
  std::function<void()> hostMoved;
  /// La fenêtre principale revient (restaurée, remontrée) : le PiP reprend son mode.
  std::function<void()> hostRestored;
};

/// La fenêtre PiP native : sans cadre, transparente (sauf Windows), hors barre des tâches.
/// Sa page (le second navigateur hors écran) est rendue par `compositor()`.
class Window {
 public:
  virtual ~Window() = default;
  virtual Box bounds() = 0;
  virtual void setBounds(const Box& box) = 0;
  /// Wayland : le glisser confié au compositeur — un client n'y pose pas sa position. true : il
  /// déplace la fenêtre sous le pointeur, la session ne suit pas le curseur. Ailleurs : false.
  virtual bool beginSystemMove() { return false; }
  /// Montrée sans prendre le focus : l'utilisateur continue dans l'application.
  virtual void showInactive() = 0;
  virtual void hide() = 0;
  /// Niveaux, bureaux, ancrage à la fenêtre principale (macOS : `pipDocking.ts`).
  virtual void applyMode(Mode mode) = 0;
  /// Peut-elle prendre ce mode ? Non sous Wayland, où l'ancrage en fait une fenêtre surgissante
  /// de la principale et où un rôle ne change pas : le contrôleur en crée alors une autre.
  virtual bool holdsMode(Mode mode) { return true; }
  /// Le titre (identifiant de la colle sous Linux ; un simple nom ailleurs).
  virtual void setCaption(const std::string& caption) = 0;
  virtual void setEvents(WindowEvents events) = 0;
  /// Avait-elle le focus clavier ? (À sa fermeture, il revient à la fenêtre principale.)
  virtual bool focused() = 0;
  /// La pile de couches de la fenêtre : la page en haut, la vidéo prêtée dessous.
  virtual Compositor* compositor() = 0;
  /// Échelle (Retina) et écran de la fenêtre, pour la page (`window.screen`).
  virtual double backingScale() = 0;
  virtual Box screenBounds() = 0;
  virtual Box screenWorkArea() = 0;
  /// Diagnostic (bancs) : niveau, focus, bureaux… en une ligne ; et l'injection d'un évènement
  /// de souris NATIF dans la fenêtre (`kind` : move, down, up, drag, scroll), sans le vrai
  /// curseur. Rend "" ou un message d'erreur.
  virtual std::string describe() { return ""; }
  virtual std::string inject(const std::string& kind, double x, double y, int clicks, double dy) {
    return "injection non prise en charge";
  }
};

/// Ce que la fenêtre PiP transmet à SA page (le navigateur hors écran du PiP).
struct PageInput {
  // Coordonnées en points de la vue ; `modifiers` : drapeaux EVENTFLAG_* de CEF.
  std::function<void(double x, double y, uint32_t modifiers, bool leave)> mouseMove;
  std::function<void(double x, double y, uint32_t modifiers, int button, bool up, int clicks)>
      mouseButton;
  std::function<void(double x, double y, uint32_t modifiers, double dx, double dy)> wheel;
  /// La fenêtre a changé de taille (ou d'échelle, `scaleChanged`) : la page relit sa vue.
  std::function<void(bool scaleChanged)> resized;
  /// Le système demande de la fermer (Alt+F4) : la page la voit fermée, comme Electron.
  std::function<void()> closeRequested;
};

/// Ce que chaque OS fournit au PiP. `nullptr` (createPlatform) : pas de PiP sur ce système
/// — les commandes `pip_*` ne sont pas déclarées, et la page cache « Réduire ».
class Platform {
 public:
  virtual ~Platform() = default;
  virtual Desktop& desktop() = 0;
  virtual Ticker& ticker() = 0;
  /// Fabrique la fenêtre PiP (cachée), à `box`, sous `caption`.
  virtual std::unique_ptr<Window> createWindow(const Box& box, Mode mode,
                                               const std::string& caption, PageInput input) = 0;
  /// Change le curseur au-dessus de la fenêtre PiP (type `cef_cursor_type_t`).
  virtual void setCursor(Window& window, int cefCursorType) = 0;
  /// Le focus retourne à la fenêtre principale (si elle est visible, sur ce bureau).
  virtual void focusHost() = 0;
};

}  // namespace tentacle::pip
