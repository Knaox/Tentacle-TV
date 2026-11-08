// Le moteur, côté chaîne : contrôle du flux, décision, téléchargement, empreinte,
// préparation. Le cycle de vie (démarrage, période d'essai, fermeture, actions de la page,
// instantané) est dans engine_lifecycle.cpp.
#include <algorithm>
#include <cstdio>

#include "update/engine.h"

namespace tentacle::update {

Engine::Engine(Platform& platform, EngineConfig config, Emit emit)
    : p_(platform), cfg_(std::move(config)), emit_(std::move(emit)) {}

std::string Engine::path(const char* name) const { return p_.stateDir() + "/" + name; }

void Engine::scheduleCheck(int64_t delayMs, bool replace) {
  if (checkScheduled_ && !replace) return;
  checkScheduled_ = true;
  // Un seul contrôle en attente : une minuterie remplacée ne fait plus rien en sonnant.
  const uint64_t token = ++timerToken_;
  p_.schedule(delayMs, [this, token] {
    if (token != timerToken_) return;
    checkScheduled_ = false;
    checkNow();
  });
}

void Engine::checkNow() {
  if (!enabled_ || checking_) return;
  if (phase_ == Phase::Downloading || phase_ == Phase::Verifying || phase_ == Phase::Staging ||
      phase_ == Phase::Applying)
    return;
  checking_ = true;  // la phase reste ce qu'elle est : une mise à jour prête reste installable
  p_.fetch(cfg_.feedUrl, cfg_.maxManifestBytes, [this](std::optional<std::string> body, std::string err) {
    checking_ = false;
    try {
      onManifest(std::move(body), std::move(err));
    } catch (const std::exception& e) {  // un flux tordu ne doit jamais faire tomber l'app
      std::fprintf(stderr, "[maj] flux refusé (exception) : %s\n", e.what());
    }
  });
}

void Engine::onManifest(std::optional<std::string> body, std::string error) {
  scheduleCheck(cfg_.checkIntervalMs);
  // Hors ligne ou flux injoignable : rien ne change, et surtout rien ne bloque.
  if (!body) return (void)std::fprintf(stderr, "[maj] flux injoignable : %s\n", error.c_str());
  std::string why;
  auto text = openEnvelope(*body, cfg_.keys, &why);
  auto m = text ? parseManifest(*text, &why) : std::nullopt;
  if (!m) return (void)std::fprintf(stderr, "[maj] manifeste refusé : %s\n", why.c_str());

  const Decision d = decide({current_, cfg_.channel, p_.platformKey(), *m, state_, p_.now()});
  std::fprintf(stderr, "[maj] %s %s → %s\n", m->version.str().c_str(), severityName(m->severity),
               d.reason.c_str());
  if (d.reason == "stale-manifest" || d.reason == "other-channel") return;
  state_.lastIssuedAt = std::max(state_.lastIssuedAt, m->issuedAt);
  persist();

  const bool sameAsBefore = manifest_ && manifest_->version == m->version;
  if (!sameAsBefore) failures_ = 0;
  manifest_ = std::move(m);
  decision_ = d;
  if (!d.install) {
    // Retirée, déjà là, revenue en arrière : une copie préparée ne doit plus s'installer.
    if (phase_ != Phase::Applying) dropStaged();
    return publish();
  }
  if (stagedVersion_ && *stagedVersion_ == manifest_->version &&
      (phase_ == Phase::Ready || phase_ == Phase::Applying))
    return publish();
  startDownload();
}

void Engine::dropStaged() {
  p_.cancelDownload();
  ++generation_;
  if (!staged_.empty()) p_.discardStaged(staged_);
  staged_.clear();
  stagedVersion_.reset();
  phase_ = Phase::Idle;
  progress_ = -1;
  error_.clear();
}

void Engine::startDownload() {
  const Asset& asset = manifest_->assets.at(p_.platformKey());
  std::string why;
  if (!p_.canSelfUpdate(&why)) return fail("cannot-install:" + why, false);
  if (!acceptableUrl(asset.url, cfg_.allowLoopbackHttp)) return fail("bad-url", false);
  dropStaged();
  applied_ = false;
  phase_ = Phase::Downloading;
  progress_ = 0;
  archive_ = path("download.part");
  publish();
  const uint64_t gen = generation_;
  const uint64_t expected = asset.size;
  p_.download(
      asset.url, archive_,
      [this, gen, expected](uint64_t got, uint64_t total) {
        if (gen != generation_) return;
        // La taille est SIGNÉE : un hôte qui en envoie plus (flux sans fin) est coupé.
        if (expected && (got > expected || total > expected)) {
          p_.cancelDownload();
          ++generation_;
          std::remove(archive_.c_str());
          return fail("size", true);
        }
        if (total == 0) total = expected;
        const double next = total ? std::min(1.0, double(got) / double(total)) : -1;
        // Une page notifiée tous les 1 % : assez pour une barre fluide, pas une averse d'IPC.
        if (next < 0 || next - progress_ >= 0.01 || next >= 1.0) {
          progress_ = next;
          publish();
        }
      },
      [this, gen](std::string err, bool network) {
        if (gen == generation_) onDownloaded(std::move(err), network);
      });
}

void Engine::onDownloaded(std::string error, bool network) {
  if (!error.empty()) return fail(network ? "network" : "download:" + error, true);
  phase_ = Phase::Verifying;
  publish();
  const Asset asset = manifest_->assets.at(p_.platformKey());
  auto ok = std::make_shared<bool>(false);
  const std::string file = archive_;
  const uint64_t gen = generation_;
  p_.background(
      [ok, file, asset] {
        auto digest = sha256File(file);
        *ok = digest && sameDigest(*digest, asset.sha256);
      },
      [this, ok, gen] {
        if (gen == generation_) onVerified(*ok);
      });
}

void Engine::onVerified(bool ok) {
  if (!ok) {
    std::remove(archive_.c_str());
    return fail("checksum", true);  // un octet retourné en route : on recommencera, plus tard
  }
  phase_ = Phase::Staging;
  publish();
  auto result = std::make_shared<std::pair<std::string, std::string>>();
  const std::string file = archive_;
  const Manifest m = *manifest_;
  const uint64_t gen = generation_;
  p_.background([this, result, file, m] { result->first = p_.stage(file, m, &result->second); },
                [this, result, gen, version = m.version] {
                  if (gen == generation_) onStaged(result->first, result->second, version);
                });
}

void Engine::onStaged(std::string error, std::string staged, Version version) {
  std::remove(archive_.c_str());
  if (!error.empty()) return fail("stage:" + error, true);
  staged_ = std::move(staged);
  stagedVersion_ = version;
  failures_ = 0;
  phase_ = Phase::Ready;
  progress_ = 1;
  publish();
}

void Engine::fail(std::string code, bool retry) {
  std::fprintf(stderr, "[maj] échec : %s\n", code.c_str());
  phase_ = Phase::Failed;
  error_ = std::move(code);
  progress_ = -1;
  ++failures_;
  publish();
  if (!retry) return;
  // Attente exponentielle plafonnée : une archive durablement refusée ne se retélécharge pas
  // toutes les cinq minutes.
  int64_t delay = cfg_.retryDelayMs;
  for (int i = 1; i < failures_ && delay < cfg_.maxRetryDelayMs; ++i) delay *= 2;
  scheduleCheck(std::min(delay, cfg_.maxRetryDelayMs), true);
}

}  // namespace tentacle::update
