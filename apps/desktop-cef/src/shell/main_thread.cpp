#include "shell/main_thread.h"

#include "include/cef_task.h"

namespace tentacle {
namespace {

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

}  // namespace

bool onMainThread() { return CefCurrentlyOn(TID_UI); }

bool postToMain(std::function<void()> fn) { return CefPostTask(TID_UI, new FunctionTask(std::move(fn))); }

void postToMainDelayed(std::function<void()> fn, int64_t delayMs) {
  CefPostDelayedTask(TID_UI, new FunctionTask(std::move(fn)), delayMs);
}

}  // namespace tentacle
