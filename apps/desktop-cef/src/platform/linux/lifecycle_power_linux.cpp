// Linux : les blocages d'économie d'énergie.
//
// L'écran : SDL3 (inhibition du compositeur Wayland `zwp_idle_inhibit_v1`, économiseur X11 et
// `org.freedesktop.ScreenSaver` par D-Bus) — ce que fait Chromium sous Electron. Le système :
// rien de plus que le renfort logind (`systemd-inhibit`, lifecycle/power_save.h), que le cycle
// de vie combine aux deux blocages, comme `ipc/shell.ts` et `downloadsRuntime.ts`.

#include <SDL3/SDL.h>
#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <sys/wait.h>
#include <unistd.h>

#include <set>

#include "lifecycle/lifecycle_platform.h"

extern char** environ;

namespace tentacle::lifecycle::platform {
namespace {

class LinuxSleepBlocker final : public SleepBlocker {
 public:
  int start(BlockerKind kind) override {
    const int id = next_++;
    if (kind == BlockerKind::PreventDisplaySleep) {
      if (displayIds_.empty()) SDL_DisableScreenSaver();
      displayIds_.insert(id);
    } else {
      systemIds_.insert(id);  // le renfort logind fait le travail (voir l'en-tête)
    }
    return id;
  }
  void stop(int id) override {
    if (displayIds_.erase(id) > 0 && displayIds_.empty()) SDL_EnableScreenSaver();
    systemIds_.erase(id);
  }
  bool isStarted(int id) const override { return displayIds_.count(id) || systemIds_.count(id); }

 private:
  int next_ = 1;
  std::set<int> displayIds_, systemIds_;
};

// `systemd-inhibit … tail --pid=<nous> -f /dev/null` : un fils qui ne lit ni n'écrit rien.
class SpawnedChild final : public ChildProcess {
 public:
  explicit SpawnedChild(pid_t pid) : pid_(pid) {}
  ~SpawnedChild() override { kill(); }
  void kill() override {
    if (reaped_) return;
    ::kill(pid_, SIGTERM);
    waitpid(pid_, nullptr, 0);
    reaped_ = true;
  }
  bool done() override {
    if (!reaped_ && waitpid(pid_, nullptr, WNOHANG) == pid_) reaped_ = true;
    return reaped_;
  }

 private:
  pid_t pid_;
  bool reaped_ = false;
};

std::unique_ptr<ChildProcess> spawnQuiet(const std::string& command, const std::vector<std::string>& args) {
  std::vector<std::string> all{command};
  all.insert(all.end(), args.begin(), args.end());
  std::vector<char*> argv;
  for (auto& a : all) argv.push_back(a.data());
  argv.push_back(nullptr);
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  for (int fd = 0; fd <= 2; ++fd) posix_spawn_file_actions_addopen(&actions, fd, "/dev/null", O_RDWR, 0);
#if defined(__GLIBC__) && (__GLIBC__ > 2 || (__GLIBC__ == 2 && __GLIBC_MINOR__ >= 34))
  // Aucun descripteur de l'app ne passe au fils (le port DevTools, les sockets de CEF…).
  posix_spawn_file_actions_addclosefrom_np(&actions, 3);
#endif
  pid_t pid = 0;
  const int r = posix_spawnp(&pid, command.c_str(), &actions, nullptr, argv.data(), environ);
  posix_spawn_file_actions_destroy(&actions);
  if (r != 0) return nullptr;  // sans systemd (Artix, Void, Alpine) : rien à inhiber
  return std::make_unique<SpawnedChild>(pid);
}

}  // namespace

SleepBlocker& sleepBlocker() {
  static LinuxSleepBlocker blocker;
  return blocker;
}

Launcher logindLauncher() { return spawnQuiet; }

long currentPid() { return long(getpid()); }

}  // namespace tentacle::lifecycle::platform
