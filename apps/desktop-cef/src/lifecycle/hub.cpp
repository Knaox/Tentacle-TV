// Ce que les modules déclarent au cycle de vie (lifecycle.h) et ce que sa colle en lit.

#include "lifecycle/hub.h"

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <memory>
#include <vector>

#include "lifecycle/lifecycle_platform.h"
#include "lifecycle/power_save.h"
#include "shell/main_thread.h"

namespace tentacle::lifecycle {
namespace {

struct Hub {
  TransfersProbe probe;
  FarewellSender sender;
  std::vector<std::function<void()>> windowClosed, systemResume;
  PlaybackFarewell farewell{[] { return int64_t(SDL_GetTicks()); }};
  std::unique_ptr<WakeLock> display, system;
};

Hub& hubState() {
  static Hub h;
  return h;
}

// Le blocage, avec le renfort logind là où il existe (Linux : `combine`, `ipc/shell.ts`).
std::unique_ptr<WakeLock> withLogind(std::unique_ptr<WakeLock> lock) {
  auto launch = platform::logindLauncher();
  if (!launch) return lock;
  std::vector<std::unique_ptr<WakeLock>> both;
  both.push_back(std::move(lock));
  both.push_back(createLogindBackup(std::move(launch), platform::currentPid()));
  return combine(std::move(both));
}

WakeLock& displayLock() {
  auto& h = hubState();
  if (!h.display) h.display = withLogind(createDisplayWakeLock(platform::sleepBlocker()));
  return *h.display;
}

WakeLock& systemLock() {
  auto& h = hubState();
  if (!h.system) h.system = withLogind(createSystemWakeLock(platform::sleepBlocker()));
  return *h.system;
}

}  // namespace

void setTransfersProbe(TransfersProbe probe) { hubState().probe = std::move(probe); }
void setFarewellSender(FarewellSender sender) { hubState().sender = std::move(sender); }
void onWindowClosed(std::function<void()> cb) { hubState().windowClosed.push_back(std::move(cb)); }
void onSystemResume(std::function<void()> cb) {
  auto& h = hubState();
  // L'écoute du système naît avec le premier abonné (`connectWake` d'Electron).
  if (h.systemResume.empty()) platform::watchSystemResume(hub::fireSystemResume);
  h.systemResume.push_back(std::move(cb));
}

void keepSystemAwake(bool on) {
  if (on) systemLock().prevent();
  else systemLock().release();
}

void preventDisplaySleep(bool on) {
  if (on) displayLock().prevent();
  else displayLock().release();
}

void noteSessionPost(const SessionPost& post) { hubState().farewell.note(post); }

std::function<void()> trackSessionPost() {
  const uint64_t token = hubState().farewell.track();
  auto once = std::make_shared<std::atomic_bool>(false);
  // N'importe quel fil (rappel du réseau) : la fin repasse par le fil principal.
  return [token, once] {
    if (once->exchange(true)) return;
    postToMain([token] { hubState().farewell.release(token); });
  };
}

namespace hub {

int transfersInFlight() {
  const auto& p = hubState().probe;
  if (!p.inFlight) return 0;
  try {
    return std::max(p.inFlight(), 0);
  } catch (...) {
    return 0;  // base indisponible : on ne retient pas la fermeture sur un doute
  }
}

bool transfersCountFails() {
  const auto& p = hubState().probe;
  if (!p.inFlight) return false;
  try {
    p.inFlight();
    return false;
  } catch (...) {
    return true;
  }
}

bool transfersBusy() {
  const auto& p = hubState().probe;
  try {
    return p.busy && p.busy();
  } catch (...) {
    return false;
  }
}

bool backgroundEnabled() {
  const auto& p = hubState().probe;
  try {
    return !p.backgroundEnabled || p.backgroundEnabled();
  } catch (...) {
    return true;  // base illisible : le défaut
  }
}

PlaybackFarewell& farewell() { return hubState().farewell; }

void sendFarewellStop(const FarewellStop& stop, std::function<void()> done) {
  const auto& sender = hubState().sender;
  if (!sender) return done();
  sender(stop, std::move(done));
}

void fireWindowClosed() {
  for (auto& cb : hubState().windowClosed) {
    try {
      cb();
    } catch (...) {
      std::fprintf(stderr, "[cycle] un abonné de « fenêtre fermée » a levé une exception\n");
    }
  }
}

void fireSystemResume() {
  for (auto& cb : hubState().systemResume) {
    try {
      cb();
    } catch (...) {
      std::fprintf(stderr, "[cycle] un abonné du retour de veille a levé une exception\n");
    }
  }
}

void releaseWakeLocks() {
  auto& h = hubState();
  if (h.display) h.display->release();
  if (h.system) h.system->release();
}

}  // namespace hub
}  // namespace tentacle::lifecycle
