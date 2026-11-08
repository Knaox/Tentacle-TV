// Linux, de bout en bout SANS CEF : une fausse app qui fait tourner le VRAI moteur sur la VRAIE
// implémentation Linux (update_linux.cpp), comme la colle du socle (update_shell.cpp) : fil
// principal à elle, « bonne santé » différée, onQuit à la fermeture. Construite en plusieurs
// versions (TENTACLE_APP_VERSION) ; posée comme fausse AppImage par bench/update/cross/linux-e2e.sh.
//   --feed=URL --key=BASE64 --state=DIR --log=FICHIER [--restart] [--quit-when-ready]
//   [--exit-after=ms] [--healthy-ms=ms]
// Défauts simulés (TENTACLE_E2E_FAULT) : 1 = meurt avant même le moteur (code 3) ;
// 2 = démarre le moteur puis meurt avant sa bonne santé (code 3).
#include <unistd.h>

#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <deque>
#include <fstream>
#include <map>
#include <mutex>
#include <string>

#include "update/engine.h"
#include "update/system.h"

#ifndef TENTACLE_E2E_FAULT
#define TENTACLE_E2E_FAULT 0
#endif

using namespace tentacle::update;
using Clock = std::chrono::steady_clock;

namespace {

// Le fil principal : tâches postées depuis n'importe quel fil, minuteries.
class Loop {
 public:
  void post(std::function<void()> fn) { at(0, std::move(fn)); }
  void at(int64_t ms, std::function<void()> fn) {
    std::lock_guard lock(m_);
    timers_.emplace(Clock::now() + std::chrono::milliseconds(ms), std::move(fn));
    cv_.notify_one();
  }
  void quit() { post([this] { running_ = false; }); }
  void run() {
    std::unique_lock lock(m_);
    while (running_) {
      if (timers_.empty()) {
        cv_.wait(lock);
        continue;
      }
      auto first = timers_.begin();
      if (first->first > Clock::now()) {
        cv_.wait_until(lock, first->first);
        continue;
      }
      auto fn = std::move(first->second);
      timers_.erase(first);
      lock.unlock();
      fn();
      lock.lock();
    }
  }

 private:
  std::mutex m_;
  std::condition_variable cv_;
  std::multimap<Clock::time_point, std::function<void()>> timers_;
  bool running_ = true;
};

std::string arg(int argc, char** argv, const std::string& name, const std::string& fallback = "") {
  for (int i = 1; i < argc; i++)
    if (std::string a = argv[i]; a.rfind("--" + name + "=", 0) == 0) return a.substr(name.size() + 3);
  return fallback;
}
bool flag(int argc, char** argv, const std::string& name) {
  for (int i = 1; i < argc; i++)
    if (argv[i] == "--" + name) return true;
  return false;
}

std::string g_log;
void say(const std::string& line) {
  std::ofstream(g_log, std::ios::app) << TENTACLE_APP_VERSION << ' ' << line << '\n';
}

}  // namespace

int main(int argc, char** argv) {
  g_log = arg(argc, argv, "log", "/dev/stderr");
  say("start pid " + std::to_string(getpid()));
  if (TENTACLE_E2E_FAULT == 1) return 3;  // plantage avant même le moteur

  Loop loop;
  SystemHooks hooks;
  hooks.post = [&loop](std::function<void()> fn) { loop.post(std::move(fn)); };
  hooks.postDelayed = [&loop](int64_t ms, std::function<void()> fn) { loop.at(ms, std::move(fn)); };
  hooks.quit = [&loop] { loop.quit(); };
  hooks.stateDir = arg(argc, argv, "state");
  auto platform = createSystemPlatform(hooks);

  EngineConfig cfg;
  cfg.feedUrl = arg(argc, argv, "feed");
  cfg.allowLoopbackHttp = true;
  cfg.firstCheckDelayMs = 200;
  cfg.retryDelayMs = 2000;
  if (auto key = publicKeyFromBase64(arg(argc, argv, "key"))) cfg.keys.push_back({"test", *key});

  const bool restart = flag(argc, argv, "restart"), quitWhenReady = flag(argc, argv, "quit-when-ready");
  std::string lastPhase, lastPrompt, lastRolledBack;
  Engine* self = nullptr;
  Engine engine(*platform, cfg, [&](const Engine::Json& s) {
    const std::string phase = s.value("phase", ""), prompt = s.value("prompt", ""), back = s.value("rolledBack", "");
    if (phase != lastPhase || prompt != lastPrompt) say("phase " + phase + " prompt " + prompt);
    if (!back.empty() && back != lastRolledBack) say("rolledBack " + back);
    lastPhase = phase, lastPrompt = prompt, lastRolledBack = back;
    if (phase != "ready" || !self) return;
    if (restart) {
      loop.post([&] {
        const std::string err = self->restartNow();
        say(err.empty() ? "restart ok" : "restart " + err);
      });
    } else if (quitWhenReady) {
      say("quit");
      loop.quit();
    }
  });
  self = &engine;
  if (!engine.start()) say("rollback launched");
  if (TENTACLE_E2E_FAULT == 2) loop.at(300, [] { _exit(3); });  // meurt avant la bonne santé
  loop.at(std::stoll(arg(argc, argv, "healthy-ms", "1000")), [&] {
    engine.markHealthy();
    say("healthy");
  });
  loop.at(std::stoll(arg(argc, argv, "exit-after", "15000")), [&] { loop.quit(); });
  loop.run();
  engine.onQuit();  // comme maj::shutdown : une mise à jour prête s'applique en silence
  say("exit");
  return 0;
}
