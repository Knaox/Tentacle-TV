#include "glass/materialize.h"

#include <algorithm>

namespace tentacle::glass {

Rect materializeFrom(const Rect& frame, const Materialize& m, double zoom) {
  const double width = frame.width * m.scale;
  const double height = frame.height * m.scale;
  return {
      frame.x + (frame.width - width) * m.originX,
      // `originY` compte depuis le HAUT ; l'axe d'AppKit monte.
      frame.y + (frame.height - height) * (1 - m.originY) - m.rise * zoom,
      width,
      height,
  };
}

NativeMotion enterMotion(const Materialize& m, double durationMs) { return {durationMs, m.enterEase}; }

NativeMotion exitMotion(const Materialize& m) { return {m.exit, m.exitEase}; }

void DelayedEntries::schedule(const std::string& id, double delayMs, std::function<void()> start) {
  cancel(id);
  pending_[id] = timers_.set(
      [this, id, start = std::move(start)] {
        pending_.erase(id);
        start();
      },
      std::max(0.0, delayMs));
}

void DelayedEntries::cancel(const std::string& id) {
  const auto it = pending_.find(id);
  if (it == pending_.end()) return;
  timers_.clear(it->second);
  pending_.erase(it);
}

void DelayedEntries::cancelAll() {
  for (const auto& [id, timer] : pending_) timers_.clear(timer);
  pending_.clear();
}

}  // namespace tentacle::glass
