#pragma once
// Poster une fonction sur un fil de CEF (UI, IO, séquence disque), sans base::Bind.

#include <functional>
#include <utility>

#include "include/cef_task.h"

namespace tentacle::net {

class FunctionTask final : public CefTask {
 public:
  explicit FunctionTask(std::function<void()> fn) : fn_(std::move(fn)) {}
  void Execute() override {
    if (fn_) fn_();
  }

 private:
  std::function<void()> fn_;
  IMPLEMENT_REFCOUNTING(FunctionTask);
};

inline bool postTo(CefThreadId thread, std::function<void()> fn) {
  return CefPostTask(thread, new FunctionTask(std::move(fn)));
}

inline bool postToDelayed(CefThreadId thread, std::function<void()> fn, int64_t delayMs) {
  return CefPostDelayedTask(thread, new FunctionTask(std::move(fn)), delayMs);
}

/// La séquence des fichiers (caches, documents) : tâches dans l'ordre, jamais deux à la fois,
/// jamais sur le fil de l'interface.
inline bool postToDisk(std::function<void()> fn) {
  return postTo(TID_FILE_USER_BLOCKING, std::move(fn));
}

}  // namespace tentacle::net
