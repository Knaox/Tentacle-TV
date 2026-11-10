// L'orchestrateur — portage de `core/engine.ts` (avec `engineHold.ts`, `networkRetry.ts` et
// le minuteur de `retry.ts`).

#include "offline/core/engine.h"

#include <algorithm>

#include "offline/core/engine_work.h"
#include "offline/core/queue.h"

namespace tentacle::offline {
namespace {

/// Un film à la fois : deux se disputeraient la bande passante et le disque.
constexpr int64_t kMaxParallel = 1;
/// Garde-fou : au-delà, on sature la connexion sans rien finir plus vite.
constexpr int64_t kParallelCeiling = 4;

/// Rend la main à la boucle : comme un `await` de JavaScript, la suite ne court jamais dans
/// la pile de l'appelant (un pilote qui répond sur-le-champ ne rentre pas dans `pump`).
CallbackAwaiter<bool> yieldTo(Scheduler& scheduler) {
  return CallbackAwaiter<bool>([&scheduler](std::function<void(bool)> done) { scheduler.post([done] { done(true); }); });
}

}  // namespace

DownloadEngine::DownloadEngine(EngineDeps deps) : deps_(std::move(deps)) {}

DownloadEngine::~DownloadEngine() { *alive_ = false; }

int64_t DownloadEngine::pending() {
  // Sans identifiants le moteur ne peut rien tirer : une file qui attend une reconnexion n'est
  // pas « en cours », et poser une question à l'utilisateur pour elle serait faux.
  if (!creds_) return 0;
  return static_cast<int64_t>(active_.size()) + countQueued(*deps_.db) + countAwaitingRetry(*deps_.db);
}

void DownloadEngine::notifyChanged() {
  if (deps_.emit) deps_.emit("downloads://changed", nullptr);
}

void DownloadEngine::start(const Creds& creds) {
  creds_ = creds;
  systemSuspended_ = false;
  // Moteur vivant (reconnexion) : ce qui tourne n'est pas « interrompu » — le remettre en file
  // le lancerait deux fois sur le même `.part`.
  if (active_.empty()) normalizeOnEngineStart(*deps_.db, deps_.now());
  else requeueSystemPauses(*deps_.db, deps_.now());
  notifyChanged();
  pump();
  if (deps_.onStarted) deps_.onStarted(creds);
}

void DownloadEngine::pump() {
  if (deps_.canTransfer && !deps_.canTransfer()) {
    if (suspendQueued(*deps_.db, deps_.now()) > 0) notifyChanged();
  } else {
    startWhatCanRun();
  }
  armRetries();
  updateActivity();
}

void DownloadEngine::sweepRetries() {
  if (requeueDueRetries(*deps_.db, deps_.now()) > 0) {
    notifyChanged();
    pump();
  } else {
    armRetries();
  }
}

void DownloadEngine::armRetries() {
  const uint64_t generation = ++retryGeneration_;
  const auto due = nextRetryDueAt(*deps_.db);
  if (!due) return;
  auto alive = alive_;
  deps_.scheduler->postDelayed(
      [this, generation, alive] {
        if (*alive && generation == retryGeneration_) sweepRetries();
      },
      std::max<int64_t>(0, *due - deps_.now()));
}

void DownloadEngine::startWhatCanRun() {
  if (!creds_) return;
  const int64_t all = std::min(std::max<int64_t>(1, kMaxParallel), kParallelCeiling);
  const int64_t music =
      std::min(std::max<int64_t>(0, deps_.musicParallelLimit ? deps_.musicParallelLimit() : 0), kParallelCeiling);
  for (;;) {
    const auto file = nextQueued(*deps_.db);
    if (!file) return;
    const bool isMusic = file->sourcePath.has_value();
    if (!mayStart(isMusic, static_cast<int64_t>(active_.size()), static_cast<int64_t>(activeMusic_.size()), all, music)) {
      return;
    }
    // `downloading` AVANT tout : sans ça, le tour suivant reprendrait le même fichier.
    setStatus(*deps_.db, file->id, "downloading", std::nullopt, deps_.now());
    // Un titre de musique : « Préparation… » jusqu'à la première réponse.
    if (isMusic && file->phase != std::optional<std::string>(kPreparePhase)) {
      setPhase(*deps_.db, file->id, std::string(kPreparePhase), deps_.now());
    }
    auto flags = std::make_shared<TransferFlags>();
    serverWaits_.erase(file->id);
    active_[file->id] = flags;
    if (isMusic) activeMusic_.insert(file->id);
    spawn(work(*creds_, file->id, flags));
  }
}

void DownloadEngine::updateActivity() {
  const bool busy = !active_.empty();
  if (busy != busy_) {
    busy_ = busy;
    if (deps_.onBusy) deps_.onBusy(busy);
  }
  const bool awaitingRetry = nextRetryDueAt(*deps_.db).has_value();
  // Plus aucune relance programmée : les attentes retenues ne tiennent plus rien.
  if (!awaitingRetry) serverWaits_.clear();
  const HoldState next{busy, awaitingRetry, awaitingRetry && !serverWaits_.empty()};
  if (next == hold_) return;
  hold_ = next;
  if (deps_.onHeld) deps_.onHeld(next);
}

Task<void> DownloadEngine::work(Creds creds, int64_t fileId, std::shared_ptr<TransferFlags> flags) {
  auto alive = alive_;
  auto hop = yieldTo(*deps_.scheduler);
  co_await hop;
  std::function<void()> changed = [this, alive] {
    if (*alive) notifyChanged();
  };
  auto attemptTask = runAttempt(deps_, creds, fileId, flags, changed);
  const Attempt attempt = co_await attemptTask;
  // La suite d'un `await` ne court jamais dans la pile du geste qui l'a provoquée : une pause
  // qui solde le transfert sur-le-champ ne doit pas relancer la file AVANT que
  // `suspendForSystem` ait fini de la mettre de côté.
  auto settle = yieldTo(*deps_.scheduler);
  co_await settle;
  if (*alive) finish(fileId, attempt.end, attempt.moved);
}

void DownloadEngine::finish(int64_t fileId, const TransferEnd& end, bool moved) {
  active_.erase(fileId);
  activeMusic_.erase(fileId);
  const bool serverWait = end.kind == TransferEnd::Kind::Failed && end.code == "network" && end.retryAfterMs.has_value();
  if (serverWait) serverWaits_.insert(fileId);
  else serverWaits_.erase(fileId);

  const int64_t now = deps_.now();
  // L'échelle des coupures réseau (`networkRetry.ts`).
  std::optional<int64_t> networkRetryAt;
  if (end.kind != TransferEnd::Kind::Failed || end.code != "network") {
    networkAttempts_.erase(fileId);
  } else if (!systemSuspended_) {
    if (end.retryAfterMs) {
      // Un serveur qui PRÉPARE et dit quand revenir : à l'heure dite, sans monter d'une marche.
      networkAttempts_.erase(fileId);
      networkRetryAt = now + *end.retryAfterMs;
    } else {
      const int64_t attempt = moved ? 0 : networkAttempts_[fileId];
      networkAttempts_[fileId] = attempt + 1;
      const auto delay = networkRetryDelay(attempt, deps_.networkRetryDelaysMs.value_or(kNetworkRetryDelaysMs));
      if (delay) networkRetryAt = now + *delay;
    }
  }
  applyEnd(*deps_.db, fileId, end,
           {now, systemSuspended_, deps_.canTransfer, deps_.retryDelaysMs.value_or(kRetryDelaysMs), networkRetryAt});
  // Une relance déjà échue (sans délai) repart dans CE tour.
  requeueDueRetries(*deps_.db, deps_.now());
  notifyChanged();
  pump();
}

void DownloadEngine::pause(int64_t fileId) {
  const auto it = active_.find(fileId);
  pauseFile(*deps_.db, fileId, it == active_.end() ? nullptr : it->second.get(), deps_.now());
  serverWaits_.erase(fileId);
  notifyChanged();
  armRetries();
  updateActivity();
}

void DownloadEngine::resume(int64_t fileId) {
  resumeFile(*deps_.db, fileId, deps_.now());
  notifyChanged();
  pump();
}

void DownloadEngine::resumeSystemPauses() {
  systemSuspended_ = false;
  if (!creds_) return;
  if (requeueSystemPauses(*deps_.db, deps_.now()) == 0) return;
  notifyChanged();
  pump();
}

void DownloadEngine::suspendForSystem() {
  systemSuspended_ = true;
  std::vector<std::shared_ptr<TransferFlags>> running;
  for (const auto& [id, flags] : active_) running.push_back(flags);
  for (const auto& flags : running) flags->setPause(true);
  const int64_t suspended = suspendQueued(*deps_.db, deps_.now());
  if (suspended > 0 || !active_.empty()) notifyChanged();
}

void DownloadEngine::cancel(int64_t fileId) {
  const auto it = active_.find(fileId);
  TransferFlags* flags = it == active_.end() ? nullptr : it->second.get();
  cancelFile(*deps_.db, deps_.volume(), fileId, flags, deps_.now());
  serverWaits_.erase(fileId);
  // Un transfert en vol posera son statut lui-même en se terminant.
  if (flags == nullptr) {
    notifyChanged();
    armRetries();
    updateActivity();
  }
}

Task<void> DownloadEngine::waitNotActive(int64_t fileId, int64_t timeoutMs) {
  const int64_t limit = deps_.now() + timeoutMs;
  while (isActive(fileId) && deps_.now() < limit) {
    auto tick = sleepFor(*deps_.scheduler, 50);
    co_await tick;
  }
}

}  // namespace tentacle::offline
