// Outils des tests de règle d'Octave : un CHECK sans dépendance (comme ceux du pont), un
// ordonnanceur à temps VIRTUEL (le `vi.useFakeTimers()` d'Electron) et des titres/sources.
#pragma once

#include <cmath>
#include <cstdio>
#include <functional>
#include <map>
#include <string>
#include <utility>

#include "music/audio_backend.h"
#include "music/audio_types.h"

inline int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)
#define CHECK_NEAR(a, b, eps) CHECK(std::fabs((a) - (b)) <= (eps))

namespace tentacle::music::testing {

// `post` = microtâche (tour suivant, temps inchangé) ; `postDelayed` = minuterie virtuelle.
class FakeScheduler final : public Scheduler {
 public:
  void post(std::function<void()> task) override { postDelayed(0, std::move(task)); }
  void postDelayed(int delayMs, std::function<void()> task) override {
    queue_.emplace(std::make_pair(now_ + delayMs, seq_++), std::move(task));
  }
  double nowMs() const override { return now_; }
  // Avance le temps de `ms`, en jouant tout ce qui tombe d'ici là (dans l'ordre).
  void advance(double ms) {
    const double until = now_ + ms;
    while (!queue_.empty() && queue_.begin()->first.first <= until) {
      auto it = queue_.begin();
      now_ = it->first.first;
      auto task = std::move(it->second);
      queue_.erase(it);
      task();
    }
    now_ = until;
  }
  void flush() { advance(0); }

 private:
  double now_ = 0;
  uint64_t seq_ = 0;
  std::multimap<std::pair<double, uint64_t>, std::function<void()>> queue_;
};

inline Track track(const std::string& key, std::optional<std::string> album = std::string("a")) {
  Track t;
  t.trackKey = key;
  t.albumKey = std::move(album);
  t.durationMs = 200000;
  return t;
}

inline Source src(const std::string& name, bool complete = true, const std::string& origin = "library") {
  Source s;
  s.url = "http://s/" + name;
  s.origin = origin;
  s.complete = complete;
  return s;
}

}  // namespace tentacle::music::testing
