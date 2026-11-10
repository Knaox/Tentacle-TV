#include "lifecycle/quit_guard.h"

namespace tentacle::lifecycle {

QuitGuard::QuitGuard(std::function<int()> inProgress, ExitRequest ask, std::function<bool()> keepsTransfers)
    : inProgress_(std::move(inProgress)), ask_(std::move(ask)), keepsTransfers_(std::move(keepsTransfers)) {}

bool QuitGuard::onClose(std::function<void()> closeAgain) {
  // Le `close` qui suit l'accord repasse ici : sans ce loquet, la fenêtre ne se fermerait jamais.
  if (state_->confirmed) return false;

  int left = 0;
  try {
    left = inProgress_ ? inProgress_() : 0;
  } catch (...) {
    return false;  // un comptage qui échoue ne doit pas retenir la fermeture
  }
  if (left <= 0) return false;

  // La fenêtre se ferme sans question : les transferts continuent sans elle.
  try {
    if (keepsTransfers_ && keepsTransfers_()) return false;
  } catch (...) {
    // Un réglage illisible ne change rien : la question, comme avant.
  }

  // Deuxième Alt+F4 pendant que la boîte est ouverte : retenue, sans seconde boîte.
  if (state_->pending) return true;
  state_->pending = true;

  auto state = state_;
  auto once = std::make_shared<bool>(false);
  auto answer = [state, once, closeAgain = std::move(closeAgain)](bool quitApp) {
    if (*once) return;
    *once = true;
    state->pending = false;
    if (!quitApp) return;
    state->confirmed = true;
    if (closeAgain) closeAgain();
  };
  try {
    ask_(left, answer);
  } catch (...) {
    // La boîte n'a pas pu s'afficher : on quitte. Rester ouvert enfermerait l'utilisateur
    // dans une fenêtre pour protéger un transfert qui reprendra de toute façon.
    answer(true);
  }
  return true;
}

}  // namespace tentacle::lifecycle
