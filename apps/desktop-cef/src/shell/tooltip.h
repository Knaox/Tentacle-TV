#pragma once
// Les bulles d'aide (`title=`) : en rendu hors écran, CEF ne fait que donner le texte
// (`CefDisplayHandler::OnTooltip`) ; l'hôte l'affiche comme Chromium dans une vraie fenêtre —
// après un délai de survol immobile, sous le curseur, retirée au clic, à la frappe, à la
// molette, à la sortie de la fenêtre ou quand le texte change. La bulle elle-même est native
// (src/platform/<os>/tooltip_<os>.*) ; le moment de l'afficher se décide ici.

#include <SDL3/SDL.h>

#include <cstdint>
#include <memory>
#include <string>

namespace tentacle {

namespace platform {
class TooltipWindow {
 public:
  virtual ~TooltipWindow() = default;
  /// `x`, `y` : curseur, en points de la fenêtre parente ; la bulle se place dessous.
  virtual void show(const std::string& text, float x, float y) = 0;
  virtual void hide() = 0;
  virtual bool visible() const = 0;
};
/// nullptr si l'OS n'offre rien (la page marche sans bulle).
std::unique_ptr<TooltipWindow> createTooltipWindow(SDL_Window* parent);
/// Délai de survol avant la bulle (celui du système, ou de Chromium là où il dessine la sienne).
int tooltipDelayMs();
}  // namespace platform

class TooltipController {
 public:
  explicit TooltipController(SDL_Window* window);
  ~TooltipController();
  /// Texte donné par CEF (vide : plus de bulle).
  void setText(const std::string& text);
  /// Évènements de la fenêtre : la souris place la bulle, un geste la retire.
  void onEvent(const SDL_Event& e);
  /// Banc : la bulle affichée (texte) ou "".
  std::string shownText() const;

 private:
  void schedule();
  void arm(uint64_t delayMs);
  void hideNative();
  std::unique_ptr<platform::TooltipWindow> native_;
  std::string text_;
  std::string shown_;
  float x_ = 0, y_ = 0;
  bool suppressed_ = false;  // retirée par un geste : pas avant un autre survol
  uint64_t generation_ = 0;
  uint64_t lastMoveMs_ = 0;
  bool timerPending_ = false;
  // Banc : le coût d'afficher et de retirer la bulle, sur le fil principal.
  double lastShowMs_ = 0, maxShowMs_ = 0, lastHideMs_ = 0, maxHideMs_ = 0;
  uint64_t shows_ = 0;
  std::shared_ptr<bool> alive_;
};

}  // namespace tentacle
