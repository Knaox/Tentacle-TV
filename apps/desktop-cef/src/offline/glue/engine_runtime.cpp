// Le moteur de transferts de l'app et ce qui l'entoure — `downloadsRuntime.ts` d'Electron :
// construit au premier besoin, purge des échéances (tout de suite, puis chaque minute),
// réparation au démarrage, reprise au réveil de veille, anti-suspension du système tant
// qu'un transfert tourne ou que le serveur prépare, et ce que la fermeture lui demande
// (`lifecycle::setTransfersProbe`, axe systeme).

#include "offline/glue/engine_runtime.h"

#include <atomic>
#include <cstdio>

#include "lifecycle/lifecycle.h"
#include "offline/core/playback.h"
#include "offline/glue/cef_transfer_net.h"
#include "offline/glue/channels.h"
#include "offline/glue/offline_thread.h"
#include "offline/glue/runtime.h"
#include "shell/main_thread.h"

namespace tentacle::offline {
namespace {

constexpr int64_t kPurgeTickMs = 60000;
/// Titres d'Octave tirés ensemble : leurs préparations par le serveur se recouvrent (banc
/// d'Electron du 28/10 : 29,6 s un à un, 11,9 s à trois). Trois : presque tout le gain.
constexpr int64_t kMusicParallel = 3;

class ThreadScheduler final : public Scheduler {
 public:
  void post(std::function<void()> task) override { thread::post(std::move(task)); }
  void postDelayed(std::function<void()> task, int64_t delayMs) override { thread::postDelayed(std::move(task), delayMs); }
};

// Ce que la fermeture lit depuis le fil principal, sans toucher la base (`TransfersProbe`).
std::atomic<int> g_inFlight{0};
std::atomic<bool> g_busy{false};
std::atomic<bool> g_awaitingServer{false};
std::atomic<bool> g_background{true};

struct EngineState {
  ThreadScheduler scheduler;
  CefTransferNet net;
  StreamDriver driver{net};
  std::unique_ptr<DownloadEngine> engine;
  bool purgeStarted = false;
};
EngineState* g_state = nullptr;  // fil hors ligne seulement

void syncWakeLock() {
  const bool on = g_busy.load() || g_awaitingServer.load();
  // Une coupure réseau sans fin ne tient pas la machine éveillée ; une attente du serveur, si.
  postToMain([on] { lifecycle::keepSystemAwake(on); });
}

void refreshPending() {
  if (g_state == nullptr || !g_state->engine) return;
  try {
    g_inFlight = static_cast<int>(g_state->engine->pending());
  } catch (...) {
    g_inFlight = 0;  // base indisponible : on ne retient pas la fermeture sur un doute
  }
}

void purgeTick() {
  try {
    Runtime& rt = runtime();
    if (purgeDueClaims(rt.db(), rt.volume(), nowMs(), std::nullopt) > 0) rt.notifyChanged();
  } catch (...) {
    // Racine sur un disque débranché : on retentera dans une minute.
  }
  thread::postDelayed(purgeTick, kPurgeTickMs);
}

void onStarted(const Creds& creds) {
  if (!g_state->purgeStarted) {
    g_state->purgeStarted = true;
    purgeTick();  // première itération IMMÉDIATE : rattrape ce qui a échu app fermée
  }
  // Réparation en tâche de fond, jamais attendue (best-effort : elle repassera).
  spawn([](Creds c) -> Task<void> {
    Runtime& rt = runtime();
    try {
      auto task = heal(makeFetcher(c.token), rt.db(), c.serverUrl, rt.volume(), nowMs(), makePublicFetcher());
      const int64_t healed = co_await task;
      if (healed > 0) rt.notifyChanged();
    } catch (...) {
    }
  }(creds));
}

}  // namespace

DownloadEngine& downloadsEngine() {
  if (g_state != nullptr && g_state->engine) return *g_state->engine;
  if (g_state == nullptr) g_state = new EngineState();
  Runtime& rt = runtime();
  EngineDeps deps;
  deps.db = &rt.db();
  deps.volume = [] { return runtime().volume(); };
  deps.driver = &g_state->driver;
  deps.scheduler = &g_state->scheduler;
  deps.makeFetcher = [](const std::string& token) { return makeFetcher(token); };
  deps.makePublicFetcher = [] { return makePublicFetcher(); };
  deps.emit = [](const std::string& event, const nlohmann::json& payload) {
    runtime().emit(event, payload);
    if (event == "downloads://changed") refreshPending();
  };
  deps.now = [] { return nowMs(); };
  deps.musicParallelLimit = [] { return kMusicParallel; };
  // Le statut en base ne dira que « imprévu » : la cause ne vit que là.
  deps.onUnexpected = [](const std::string& context, const std::string& error) {
    std::fprintf(stderr, "[transferts] %s : %s\n", context.c_str(), error.c_str());
  };
  deps.onBusy = [](bool busy) {
    g_busy = busy;
    syncWakeLock();
  };
  deps.onHeld = [](const HoldState& state) {
    g_awaitingServer = state.awaitingServer;
    syncWakeLock();
  };
  deps.onStarted = onStarted;
  g_state->engine = std::make_unique<DownloadEngine>(std::move(deps));
  g_background = backgroundTransfersOn();
  return *g_state->engine;
}

DownloadEngine* existingEngine() { return g_state == nullptr ? nullptr : g_state->engine.get(); }

void noteBackgroundSetting(bool on) { g_background = on; }

void installEngineRuntime() {
  lifecycle::setTransfersProbe({
      [] { return g_inFlight.load(); },
      [] { return g_busy.load() || g_awaitingServer.load(); },
      [] { return g_background.load(); },
  });
  // L'anti-suspension repousse la veille d'INACTIVITÉ, pas celle que l'utilisateur déclenche :
  // au réveil, les pauses SYSTÈME repartent (sans quoi elles attendaient le prochain lancement).
  lifecycle::onSystemResume([] {
    thread::post([] {
      if (DownloadEngine* engine = existingEngine()) engine->resumeSystemPauses();
    });
  });
}

void shutdownEngineRuntime() {
  // Fil hors ligne, juste avant la fermeture de la base : l'anti-suspension est rendue.
  if (g_busy.load() || g_awaitingServer.load()) postToMain([] { lifecycle::keepSystemAwake(false); });
}

}  // namespace tentacle::offline
