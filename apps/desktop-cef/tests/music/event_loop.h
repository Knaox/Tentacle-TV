// Faux natif d'Octave — un « fil principal » minimal : une file de tâches
// (postables de n'importe quel fil) et des minuteries, tournée à la demande.
#pragma once

#include <chrono>
#include <condition_variable>
#include <deque>
#include <functional>
#include <map>
#include <mutex>

#include "music/audio_backend.h"

namespace tentacle::music::test {

class EventLoop final : public Scheduler {
 public:
  using Clock = std::chrono::steady_clock;

  void post(std::function<void()> task) override {
    std::lock_guard lock(mutex_);
    tasks_.push_back(std::move(task));
    cv_.notify_one();
  }

  void postDelayed(int delayMs, std::function<void()> task) override {
    std::lock_guard lock(mutex_);
    timers_.emplace(Clock::now() + std::chrono::milliseconds(delayMs), std::move(task));
    cv_.notify_one();
  }

  // Tourne jusqu'à ce que `done()` soit vrai ou `timeoutMs` écoulé. Rend `done()`.
  bool runUntil(const std::function<bool()>& done, int timeoutMs) {
    auto deadline = Clock::now() + std::chrono::milliseconds(timeoutMs);
    while (!done()) {
      std::function<void()> task;
      {
        std::unique_lock lock(mutex_);
        auto wake = deadline;
        if (!timers_.empty() && timers_.begin()->first < wake) wake = timers_.begin()->first;
        cv_.wait_until(lock, wake, [&] {
          return !tasks_.empty() || (!timers_.empty() && timers_.begin()->first <= Clock::now());
        });
        if (!tasks_.empty()) {
          task = std::move(tasks_.front());
          tasks_.pop_front();
        } else if (!timers_.empty() && timers_.begin()->first <= Clock::now()) {
          task = std::move(timers_.begin()->second);
          timers_.erase(timers_.begin());
        } else if (Clock::now() >= deadline) {
          return done();
        }
      }
      if (task) task();
    }
    return true;
  }

  void runFor(int ms) {
    runUntil([] { return false; }, ms);
  }

 private:
  std::mutex mutex_;
  std::condition_variable cv_;
  std::deque<std::function<void()>> tasks_;
  std::multimap<Clock::time_point, std::function<void()>> timers_;
};

}  // namespace tentacle::music::test
