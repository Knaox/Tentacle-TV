// Octave — des minuteries ANNULABLES sur le fil principal (`Scheduler::postDelayed`), le
// `setTimeout`/`clearTimeout` du moteur d'Electron. Une minuterie annulée, ou dont le
// propriétaire est détruit, ne se déclenche jamais.
#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <set>

#include "music/audio_backend.h"

namespace tentacle::music {

class Timers {
 public:
  using Id = uint64_t;
  explicit Timers(Scheduler& scheduler) : scheduler_(scheduler) {}
  ~Timers() { live_->clear(); }
  Timers(const Timers&) = delete;
  Timers& operator=(const Timers&) = delete;

  Id after(int delayMs, std::function<void()> fn) {
    const Id id = ++next_;
    live_->insert(id);
    std::weak_ptr<std::set<Id>> live = live_;
    scheduler_.postDelayed(delayMs < 0 ? 0 : delayMs, [live, id, fn = std::move(fn)] {
      auto set = live.lock();
      if (!set || set->erase(id) == 0) return;
      fn();
    });
    return id;
  }
  // Annule ; sans effet sur une minuterie déjà partie (ou 0).
  void cancel(Id id) { live_->erase(id); }
  bool pending(Id id) const { return live_->count(id) > 0; }
  void cancelAll() { live_->clear(); }

 private:
  Scheduler& scheduler_;
  std::shared_ptr<std::set<Id>> live_ = std::make_shared<std::set<Id>>();
  Id next_ = 0;
};

}  // namespace tentacle::music
