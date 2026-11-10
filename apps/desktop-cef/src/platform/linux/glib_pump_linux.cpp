#include "platform/linux/glib_pump_linux.h"

#include <glib.h>
#include <poll.h>
#include <sys/eventfd.h>
#include <unistd.h>

#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <cstdint>
#include <mutex>
#include <thread>
#include <vector>

namespace tentacle::platform {
namespace {

struct Bridge {
  GMainContext* ctx = nullptr;
  std::function<void()> wake;
  // Fil principal seulement : le cycle prepare → query → (attente) → check → dispatch.
  bool prepared = false;
  gint priority = 0;
  std::vector<GPollFD> fds = std::vector<GPollFD>(16);
  int count = 0;
  // Partagé avec le guetteur (sous `m`).
  std::mutex m;
  std::condition_variable cv;
  std::vector<GPollFD> armedFds;
  int timeoutMs = -1;
  bool armed = false, polling = false, quit = false;
  int interrupt = -1;  // eventfd : l'ensemble a changé pendant l'attente, ou arrêt
  std::thread watcher;
};

Bridge* g = nullptr;

void watch() {
  for (;;) {
    std::vector<pollfd> p;
    int timeout = -1;
    {
      std::unique_lock lk(g->m);
      g->cv.wait(lk, [] { return g->armed || g->quit; });
      if (g->quit) return;
      for (const auto& f : g->armedFds) p.push_back({f.fd, short(f.events), 0});
      timeout = g->timeoutMs;
      g->armed = false;
      g->polling = true;
    }
    p.push_back({g->interrupt, POLLIN, 0});
    const int r = poll(p.data(), nfds_t(p.size()), timeout);
    bool ready = r == 0;  // délai écoulé : une source minutée attend
    for (size_t i = 0; i + 1 < p.size(); ++i) ready = ready || p[i].revents != 0;
    if (p.back().revents & POLLIN) {
      uint64_t drain;
      (void)!read(g->interrupt, &drain, sizeof drain);
    }
    {
      std::lock_guard lk(g->m);
      g->polling = false;
      if (g->quit) return;
    }
    // Interrompu sans rien de prêt : un nouvel ensemble est armé, on y retourne.
    if (ready && std::getenv("TENTACLE_PUMP_TRACE")) {
      std::string why = r == 0 ? "délai " + std::to_string(timeout) + " ms" : "fd";
      for (size_t i = 0; i + 1 < p.size(); ++i)
        if (p[i].revents) why += " " + std::to_string(p[i].fd) + ":" + std::to_string(p[i].revents);
      std::fprintf(stderr, "[glib] réveil (%s) sur %zu fd\n", why.c_str(), p.size() - 1);
    }
    if (ready) g->wake();
  }
}

}  // namespace

void startGlibBridge(std::function<void()> wake) {
  if (g) return;
  g = new Bridge();
  g->ctx = g_main_context_default();
  g->wake = std::move(wake);
  g->interrupt = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
  // Le fil principal possède le contexte pour toute la vie de l'app (prepare/check/dispatch).
  g_main_context_acquire(g->ctx);
  g->watcher = std::thread(watch);
  armGlib();
}

void serviceGlib() {
  if (!g || !g->prepared) return;
  // L'état des descripteurs MAINTENANT (le guetteur a pu attendre un ensemble plus ancien).
  std::vector<pollfd> p;
  for (int i = 0; i < g->count; ++i) p.push_back({g->fds[i].fd, short(g->fds[i].events), 0});
  if (!p.empty()) poll(p.data(), nfds_t(p.size()), 0);
  for (int i = 0; i < g->count; ++i) g->fds[i].revents = gushort(p[i].revents);
  g->prepared = false;
  if (g_main_context_check(g->ctx, g->priority, g->fds.data(), g->count)) g_main_context_dispatch(g->ctx);
}

void armGlib() {
  if (!g || g->prepared) return;
  g_main_context_prepare(g->ctx, &g->priority);
  gint timeout = -1;
  int n = g_main_context_query(g->ctx, g->priority, &timeout, g->fds.data(), gint(g->fds.size()));
  if (n > int(g->fds.size())) {
    g->fds.resize(size_t(n));
    n = g_main_context_query(g->ctx, g->priority, &timeout, g->fds.data(), n);
  }
  g->count = n;
  g->prepared = true;
  std::lock_guard lk(g->m);
  g->armedFds.assign(g->fds.begin(), g->fds.begin() + n);
  // La source de travail de MessagePumpGlib se dit TOUJOURS prête (délai 0) : en pompe externe,
  // c'est CefDoMessageLoopWork qui exécute les tâches, pas sa dispatch (mesuré : 13 800 réveils
  // par seconde au repos). Le guetteur n'attend donc que les descripteurs — dont le tube de
  // réveil de Chromium ; les délais de CEF passent par OnScheduleMessagePumpWork (minuteur SDL).
  g->timeoutMs = timeout == 0 ? -1 : timeout;
  g->armed = true;
  if (g->polling) {
    const uint64_t one = 1;
    (void)!write(g->interrupt, &one, sizeof one);
  }
  g->cv.notify_one();
}

void stopGlibBridge() {
  if (!g) return;
  {
    std::lock_guard lk(g->m);
    g->quit = true;
    const uint64_t one = 1;
    (void)!write(g->interrupt, &one, sizeof one);
  }
  g->cv.notify_one();
  g->watcher.join();
  if (g->prepared) serviceGlib();
  g_main_context_release(g->ctx);
  close(g->interrupt);
  delete g;
  g = nullptr;
}

}  // namespace tentacle::platform
