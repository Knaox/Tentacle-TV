#include "lifecycle/close_sequence.h"

namespace tentacle::lifecycle {

CloseSequence::CloseSequence(ClosingWindow window, std::function<bool()> playerRunning,
                             std::function<void(std::function<void()>)> stopPlayer, After after,
                             int64_t deadlineMs)
    : window_(std::move(window)),
      playerRunning_(std::move(playerRunning)),
      stopPlayer_(std::move(stopPlayer)),
      after_(std::move(after)),
      deadlineMs_(deadlineMs) {}

bool CloseSequence::onClose(bool defaultPrevented) {
  // Deuxième fermeture pendant le démontage : on la laisse passer (fenêtre déjà cachée).
  if (closing_) return false;
  // La garde de sortie a la parole en premier : sa boîte est ouverte.
  if (defaultPrevented) return false;

  bool running = false;
  try {
    running = playerRunning_ && playerRunning_();
  } catch (...) {
    return false;  // un lecteur qu'on n'arrive pas à interroger ne retient pas la fermeture
  }
  if (!running) return false;

  closing_ = true;
  // La fenêtre s'en va MAINTENANT, avant tout travail.
  if (window_.hide) window_.hide();

  auto done = std::make_shared<bool>(false);
  auto window = window_;
  auto finish = [done, window] {
    if (*done) return;
    *done = true;
    if (!(window.isDestroyed && window.isDestroyed()) && window.destroy) window.destroy();
  };
  if (after_) after_(deadlineMs_, finish);
  // Un arrêt qui échoue (ou lève) ne laisse pas une fenêtre cachée et une app vivante.
  try {
    if (stopPlayer_) stopPlayer_(finish);
    else finish();
  } catch (...) {
    finish();
  }
  return true;
}

}  // namespace tentacle::lifecycle
