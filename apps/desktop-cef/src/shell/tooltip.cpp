#include "shell/tooltip.h"

#include <cstdlib>

#include "shell/ipc.h"
#include "shell/json.h"
#include "shell/main_thread.h"
#include "shell/stall_meter.h"

namespace tentacle {

TooltipController::TooltipController(SDL_Window* window)
    : native_(platform::createTooltipWindow(window)),
      alive_(std::make_shared<bool>(true)) {
  // Banc : `navigateur.debug.tooltip` → `{text, shown}` (texte reçu de CEF, bulle affichée) et ce
  // qu'afficher et retirer la bulle ont coûté au fil principal (ms : dernier, pire).
  if (!std::getenv("TENTACLE_DEBUG_NAVIGATEUR")) return;
  ipc::registerHandler("navigateur.debug.tooltip", [this](const Json&, ipc::Responder r) {
    r.reply(Json{{"text", text_}, {"shown", shownText()}, {"shows", shows_},
                 {"lastShowMs", lastShowMs_}, {"maxShowMs", maxShowMs_},
                 {"lastHideMs", lastHideMs_}, {"maxHideMs", maxHideMs_}});
  });
}

TooltipController::~TooltipController() {
  *alive_ = false;
  if (std::getenv("TENTACLE_DEBUG_NAVIGATEUR")) ipc::unregisterHandler("navigateur.debug.tooltip");
  if (native_) native_->hide();
}

void TooltipController::setText(const std::string& text) {
  if (text == text_) return;
  text_ = text;
  suppressed_ = false;
  ++generation_;
  timerPending_ = false;
  if (native_ && native_->visible()) hideNative();
  shown_.clear();
  if (!text_.empty()) schedule();
}

void TooltipController::hideNative() {
  lastHideMs_ = stall::timedInner("bulle d'aide : retirer", [this] { native_->hide(); });
  if (lastHideMs_ > maxHideMs_) maxHideMs_ = lastHideMs_;
}

void TooltipController::schedule() {
  // Un seul minuteur à la fois : chaque mouvement ne fait que repousser l'échéance (la souris
  // bouge à la fréquence de l'écran ; pas une tâche par mouvement).
  lastMoveMs_ = SDL_GetTicks();
  if (!native_ || timerPending_) return;
  timerPending_ = true;
  arm(uint64_t(platform::tooltipDelayMs()));
}

void TooltipController::arm(uint64_t delayMs) {
  const uint64_t gen = generation_;
  auto alive = alive_;
  postToMainDelayed(
      [this, alive, gen] {
        // Périmé (texte changé, geste) : un autre minuteur a pris le relais, ou aucun.
        if (!*alive || gen != generation_) return;
        if (text_.empty() || suppressed_) {
          timerPending_ = false;
          return;
        }
        const uint64_t quiet = SDL_GetTicks() - lastMoveMs_;
        const uint64_t delay = uint64_t(platform::tooltipDelayMs());
        if (quiet < delay) return arm(delay - quiet);
        timerPending_ = false;
        lastShowMs_ = stall::timedInner("bulle d'aide : afficher", [this] { native_->show(text_, x_, y_); });
        if (lastShowMs_ > maxShowMs_) maxShowMs_ = lastShowMs_;
        ++shows_;
        shown_ = text_;
      },
      int64_t(delayMs));
}

void TooltipController::onEvent(const SDL_Event& e) {
  switch (e.type) {
    case SDL_EVENT_MOUSE_MOTION:
      x_ = e.motion.x;
      y_ = e.motion.y;
      // Pas encore affichée : le délai court depuis le dernier mouvement (survol immobile).
      if (!text_.empty() && shown_.empty() && !suppressed_) schedule();
      return;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_WHEEL:
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_WINDOW_MOUSE_LEAVE:
    case SDL_EVENT_WINDOW_FOCUS_LOST:
    case SDL_EVENT_WINDOW_HIDDEN:
    case SDL_EVENT_WINDOW_MINIMIZED:
      // Un geste retire la bulle ; elle ne revient qu'avec un autre survol (texte nouveau).
      ++generation_;
      timerPending_ = false;
      if (native_ && native_->visible()) hideNative();
      shown_.clear();
      suppressed_ = true;
      return;
    default:
      return;
  }
}

std::string TooltipController::shownText() const {
  return native_ && native_->visible() ? shown_ : "";
}

}  // namespace tentacle
