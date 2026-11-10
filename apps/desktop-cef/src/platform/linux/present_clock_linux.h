#pragma once
// Le compte des images présentées par le compositeur Linux (fenêtre glissante d'une seconde),
// pour `shell.stats`. Sorti de compositor_linux.cpp, qui ne fait qu'empiler.

#include <chrono>

#include "compositor/compositor.h"

namespace tentacle::platform {

class PresentClock {
 public:
  /// Une image vient d'être présentée (eglSwapBuffers réussi).
  void tick(CompositorStats& stats) {
    const auto now = std::chrono::steady_clock::now();
    stats.presentedFrames++;
    if (lastPresent_.time_since_epoch().count()) {
      const double ms = std::chrono::duration<double, std::milli>(now - lastPresent_).count();
      if (ms > stats.presentIntervalMaxMs) stats.presentIntervalMaxMs = ms;
      stats.presentIntervalMeanMs = stats.presentIntervalMeanMs * 0.95 + ms * 0.05;
    }
    lastPresent_ = now;
    if (now - windowStart_ >= std::chrono::seconds(1)) {
      stats.presentedFps = double(stats.presentedFrames - windowFrames_) /
                           std::chrono::duration<double>(now - windowStart_).count();
      windowStart_ = now;
      windowFrames_ = stats.presentedFrames;
    }
  }

 private:
  uint64_t windowFrames_ = 0;
  std::chrono::steady_clock::time_point lastPresent_{}, windowStart_ = std::chrono::steady_clock::now();
};

}  // namespace tentacle::platform
