// Linux : ce que le cycle de vie demande au système.
//
// - Notification : libnotify chargée à l'exécution, comme Electron (absente : rien, la fin des
//   transferts se fait quand même — `Notification.isSupported()` faux).
// - Boîte et sélecteur de dossier : SDL3 (zenity / X11, portail XDG) — lifecycle/sdl_system.h.
// - Retour de veille : Electron écoute `PrepareForSleep` de logind par D-Bus ; sans bibliothèque
//   D-Bus, la veille se lit dans les horloges — CLOCK_MONOTONIC s'arrête pendant la veille,
//   CLOCK_BOOTTIME non : leur écart qui grandit dit que la machine a dormi.
// - Liens : par la ligne de commande et la seconde instance (CEF) ; aucun évènement à poser.

#include <dlfcn.h>
#include <signal.h>
#include <spawn.h>
#include <time.h>
#include <unistd.h>

#include <chrono>
#include <cstdlib>
#include <string>
#include <thread>
#include <vector>

#include "lifecycle/lifecycle_platform.h"
#include "lifecycle/sdl_system.h"
#include "shell/main_thread.h"

extern char** environ;

namespace tentacle::lifecycle::platform {
namespace {

constexpr int64_t kResumeProbeMs = 15'000;
constexpr int64_t kSleptAtLeastMs = 3'000;

int64_t clockMs(clockid_t id) {
  timespec ts{};
  clock_gettime(id, &ts);
  return int64_t(ts.tv_sec) * 1000 + ts.tv_nsec / 1'000'000;
}

int64_t sleptMs() { return clockMs(CLOCK_BOOTTIME) - clockMs(CLOCK_MONOTONIC); }

void probeResume(std::function<void()> onResume, int64_t lastSlept) {
  postToMainDelayed(
      [onResume, lastSlept] {
        const int64_t slept = sleptMs();
        if (slept - lastSlept >= kSleptAtLeastMs) onResume();
        probeResume(onResume, slept);
      },
      kResumeProbeMs);
}

}  // namespace

bool systemLocaleIsFrench() {
  // L'ordre de gettext : LANGUAGE (liste), LC_ALL, LC_MESSAGES, LANG.
  for (const char* name : {"LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"}) {
    const char* v = std::getenv(name);
    if (v && *v) return std::string(v).rfind("fr", 0) == 0;
  }
  return false;
}

void notify(const std::string& title, const std::string& body) {
  using Init = int (*)(const char*);
  using New = void* (*)(const char*, const char*, const char*);
  using Show = int (*)(void*, void**);
  using SetHint = void (*)(void*, const char*, void*);
  using Bool = void* (*)(int);
  using Unref = void (*)(void*);
  static void* lib = dlopen("libnotify.so.4", RTLD_LAZY | RTLD_LOCAL);
  if (!lib) return;
  auto init = reinterpret_cast<Init>(dlsym(lib, "notify_init"));
  auto create = reinterpret_cast<New>(dlsym(lib, "notify_notification_new"));
  auto show = reinterpret_cast<Show>(dlsym(lib, "notify_notification_show"));
  auto setHint = reinterpret_cast<SetHint>(dlsym(lib, "notify_notification_set_hint"));
  auto boolean = reinterpret_cast<Bool>(dlsym(RTLD_DEFAULT, "g_variant_new_boolean"));
  auto unref = reinterpret_cast<Unref>(dlsym(RTLD_DEFAULT, "g_object_unref"));
  if (!init || !create || !show || !init("Tentacle TV")) return;
  void* n = create(title.c_str(), body.c_str(), nullptr);
  if (!n) return;
  if (setHint && boolean) setHint(n, "suppress-sound", boolean(1));  // `silent: true`
  show(n, nullptr);
  if (unref) unref(n);
}

void askQuit(SDL_Window* window, const QuitTexts& texts, std::function<void(bool)> answer) {
  askQuitWithSdl(window, texts, std::move(answer));
}

void pickFolder(SDL_Window* window, std::function<void(std::optional<std::string>)> done) {
  pickFolderWithSdl(window, std::move(done));
}

void watchSystemResume(std::function<void()> onResume) { probeResume(std::move(onResume), sleptMs()); }

bool spawnSuccessor(const std::vector<std::string>& argv) {
  char exe[4096] = {};
  const ssize_t n = readlink("/proc/self/exe", exe, sizeof(exe) - 1);
  if (n <= 0) return false;
  std::vector<std::string> args{std::string(exe, size_t(n))};
  for (size_t i = 1; i < argv.size(); ++i) args.push_back(argv[i]);
  args.push_back("--relaunch-after=" + std::to_string(getpid()));
  std::vector<char*> raw;
  for (auto& a : args) raw.push_back(a.data());
  raw.push_back(nullptr);
  posix_spawnattr_t attr;
  posix_spawnattr_init(&attr);
  posix_spawnattr_setflags(&attr, POSIX_SPAWN_SETPGROUP);  // survit à notre groupe
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
#if defined(__GLIBC__) && (__GLIBC__ > 2 || (__GLIBC__ == 2 && __GLIBC_MINOR__ >= 34))
  // Aucun descripteur ne passe : le verrou d'instance unique de CEF en est un.
  posix_spawn_file_actions_addclosefrom_np(&actions, 3);
#endif
  pid_t pid = 0;
  const int r = posix_spawn(&pid, raw[0], &actions, &attr, raw.data(), environ);
  posix_spawn_file_actions_destroy(&actions);
  posix_spawnattr_destroy(&attr);
  return r == 0;
}

void waitForProcessExit(long pid, int timeoutMs) {
  const auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
  while (kill(pid_t(pid), 0) == 0 && std::chrono::steady_clock::now() < end) {
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
  }
}

void installSystemEvents(std::function<void(const std::string&)>, std::function<void()>) {}
void reclaimSystemEvents() {}

void prepareMainWindow(SDL_Window* window) { setWindowIconFromPng(window); }
double titleBarHeight() { return 0; }  // vrai cadre : la page ne dessine aucune bande
bool hasWindowFocusBridge() { return false; }
void setAboutPanel(const std::string&, const std::string&) {}  // pas de menu hors macOS

namespace {
bool g_noActivation = false;
}  // namespace

void setNoActivation(bool on) { g_noActivation = on; }
std::string windowDebug(SDL_Window*) { return "{}"; }
std::string sheetDebug(SDL_Window*, int) { return "{}"; }  // boîtes modales SDL : rien d'attaché

void focusWindow(SDL_Window* window) {
  if (!window || g_noActivation) return;
  if (SDL_GetWindowFlags(window) & SDL_WINDOW_MINIMIZED) SDL_RestoreWindow(window);
  SDL_RaiseWindow(window);
}

}  // namespace tentacle::lifecycle::platform
