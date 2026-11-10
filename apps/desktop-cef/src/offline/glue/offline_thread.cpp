#include "offline/glue/offline_thread.h"

#include <cstdio>
#include <mutex>
#include <utility>

#include "include/cef_task.h"
#include "include/cef_thread.h"

namespace tentacle::offline::thread {
namespace {

class FunctionTask final : public CefTask {
 public:
  explicit FunctionTask(std::function<void()> fn) : fn_(std::move(fn)) {}
  void Execute() override {
    try {
      fn_();
    } catch (const std::exception& e) {
      // Une tâche qui lève ne doit pas emporter le fil : la trace suffit, le reste continue.
      std::fprintf(stderr, "[offline] tâche : %s\n", e.what());
    }
  }

 private:
  std::function<void()> fn_;
  IMPLEMENT_REFCOUNTING(FunctionTask);
};

CefRefPtr<CefThread> g_thread;  // fil principal seulement
// Lu depuis n'importe quel fil (post) : protégé, il disparaît à l'arrêt.
std::mutex g_mutex;
CefRefPtr<CefTaskRunner> g_runner;

CefRefPtr<CefTaskRunner> runner() {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_runner;
}

}  // namespace

void start() {
  if (g_thread) return;
  g_thread = CefThread::CreateThread("tentacle-offline");
  std::lock_guard<std::mutex> lock(g_mutex);
  g_runner = g_thread->GetTaskRunner();
}

void stop(std::function<void()> last) {
  if (!g_thread) return;
  if (last) post(std::move(last));
  // Joint après les tâches en attente — la base se referme donc avant le retour.
  g_thread->Stop();
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_runner = nullptr;
  }
  g_thread = nullptr;
}

bool current() {
  const auto r = runner();
  return r && r->BelongsToCurrentThread();
}

void post(std::function<void()> task) {
  if (const auto r = runner()) r->PostTask(new FunctionTask(std::move(task)));
}

void postDelayed(std::function<void()> task, int64_t delayMs) {
  if (const auto r = runner()) r->PostDelayedTask(new FunctionTask(std::move(task)), delayMs);
}

}  // namespace tentacle::offline::thread
