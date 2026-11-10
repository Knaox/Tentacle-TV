#include "lifecycle/background_drain.h"

namespace tentacle::lifecycle {

void BackgroundDrain::end(const std::function<void()>& then) {
  active_ = false;
  if (stopTimer_) {
    auto stop = std::move(stopTimer_);
    stopTimer_ = nullptr;
    stop();
  }
  if (then) then();
}

void BackgroundDrain::check() {
  if (!active_) return;
  int left = 0;
  try {
    left = deps_.pending ? deps_.pending() : 0;
  } catch (...) {
    // Une base qui ne répond plus ne retient pas le processus.
  }
  if (left <= 0) return end(deps_.quit);
  if (deps_.busy && deps_.busy()) {
    idle_ = false;
    return;
  }
  if (!idle_) {
    idle_ = true;
    idleSince_ = deps_.now();
  }
  if (deps_.now() - idleSince_ >= kDrainIdleGiveUpMs) end(deps_.quit);
}

void BackgroundDrain::begin() {
  if (active_) return;
  active_ = true;
  idle_ = false;
  if (deps_.stopPlayback) deps_.stopPlayback();
  int pending = 0;
  try {
    pending = deps_.pending ? deps_.pending() : 0;
  } catch (...) {
  }
  if (deps_.announce) deps_.announce(pending);
  if (deps_.every) stopTimer_ = deps_.every(kDrainTickMs, [this] { check(); });
}

bool BackgroundDrain::reopen() {
  if (!active_) return false;
  end(deps_.relaunch);
  return true;
}

}  // namespace tentacle::lifecycle
