// Le moteur, côté cycle de vie : démarrage et période d'essai, fermeture, actions de la
// page, instantané envoyé à la surcouche.
#include <algorithm>
#include <cstdio>
#include <filesystem>

#include "update/engine.h"

namespace tentacle::update {
namespace {

Engine::Json localizedJson(const Localized& l) { return {{"fr", l.fr}, {"en", l.en}}; }

bool exists(const std::string& p) {
  std::error_code ec;
  return !p.empty() && std::filesystem::exists(p, ec);
}

}  // namespace

bool Engine::start() {
  auto current = p_.currentVersion();
  enabled_ = current && !cfg_.feedUrl.empty() && !cfg_.keys.empty() &&
             acceptableUrl(cfg_.feedUrl, cfg_.allowLoopbackHttp);
  if (current) current_ = *current;
  state_ = loadState(path("state.json")).value_or(DeviceState{});
  checkProbation();
  if (phase_ == Phase::Applying) return false;  // retour arrière lancé : l'app s'arrête
  if (!enabled_) {
    std::fprintf(stderr, "[maj] désactivée (flux, clé ou version absents)\n");
    return true;
  }
  scheduleCheck(cfg_.firstCheckDelayMs);
  return true;
}

// Période d'essai d'une version fraîchement posée : compter les lancements qui n'arrivent
// pas à la bonne santé ; au-delà du seuil, revenir à l'ancienne copie.
void Engine::checkProbation() {
  auto pr = loadProbation(path("probation.json"));
  if (!pr) return;
  if (!pr->rolledBack.empty()) {  // l'assistant est revenu en arrière : on s'en souvient
    if (std::find(state_.badVersions.begin(), state_.badVersions.end(), pr->rolledBack) == state_.badVersions.end())
      state_.badVersions.push_back(pr->rolledBack);
    rolledBackNotice_ = pr->rolledBack;
    pr->rolledBack.clear();
    persist();
    saveProbation(path("probation.json"), *pr);
    return;
  }
  if (pr->version != current_.str() || pr->healthy) return;
  pr->launches++;
  if (pr->launches > cfg_.probationLaunches) {
    // Sans ancienne copie (effacée, app déplacée) : pas de retour possible. On cesse de
    // compter plutôt que de quitter à chaque lancement.
    if (!exists(pr->previousPath) || !exists(pr->appPath)) {
      std::fprintf(stderr, "[maj] %s ne tient pas, mais aucune ancienne copie : on la garde\n", pr->version.c_str());
      pr->previousPath.clear();
      pr->healthy = true;
    } else {
      std::fprintf(stderr, "[maj] %s ne démarre pas (%d essais) : retour arrière\n", pr->version.c_str(), pr->launches);
      if (p_.rollback(*pr).empty()) {
        // La période d'essai appartient désormais au retour arrière (l'assistant macOS l'écrit
        // après notre sortie, Linux tout de suite) : ne pas l'écraser avec la nôtre.
        phase_ = Phase::Applying;
        p_.quitApp();
        return;
      }
    }
  }
  saveProbation(path("probation.json"), *pr);
}

void Engine::markHealthy() {
  auto pr = loadProbation(path("probation.json"));
  if (!pr || pr->version != current_.str()) return;
  if (!pr->healthy) pr->healthy = true;
  const std::string old = pr->previousPath;  // aussi après une fermeture propre (onQuit)
  pr->previousPath.clear();
  saveProbation(path("probation.json"), *pr);
  if (exists(old)) p_.background([this, old] { p_.removeTree(old); }, [] {});
}

std::string Engine::restartNow() {
  if (phase_ != Phase::Ready || !stagedVersion_) return "not-ready";
  phase_ = Phase::Applying;
  publish();
  std::string err = p_.apply(staged_, *stagedVersion_, true);
  if (!err.empty()) {
    fail("apply:" + err, false);
    return err;
  }
  applied_ = true;
  p_.quitApp();
  return {};
}

void Engine::onQuit() {
  // Une fermeture propre prouve que la version en essai fonctionne : ce n'est pas un échec.
  // Sauf si l'on quitte POUR revenir en arrière (ou pour poser une version) : rien à prouver.
  if (auto pr = loadProbation(path("probation.json"));
      pr && phase_ != Phase::Applying && pr->version == current_.str() && !pr->healthy) {
    pr->healthy = true;
    saveProbation(path("probation.json"), *pr);  // l'ancienne copie s'effacera au prochain lancement
  }
  p_.cancelDownload();
  ++generation_;
  if (phase_ != Phase::Ready || applied_ || staged_.empty() || !stagedVersion_) return;
  // Mineure (ou majeure remise à plus tard) : posée en silence, effective au prochain lancement.
  applied_ = p_.apply(staged_, *stagedVersion_, false).empty();
}

void Engine::later() {
  if (manualNotice()) {  // rappel le lendemain, pour CETTE version (une mineure n'a pas de clé de majeure)
    state_.snoozedVersion = manifest_->version.str();
    state_.snoozedUntil = p_.now() + cfg_.snoozeSeconds;
    persist();
    return publish();
  }
  if (decision_.prompt != Prompt::Toast || decision_.mandatory || decision_.muteKey.empty()) return;
  state_.snoozedVersion = decision_.muteKey;
  state_.snoozedUntil = p_.now() + cfg_.snoozeSeconds;
  persist();
  redecide();
}

void Engine::muteUntilNextMajor() {
  if (!decision_.canMute) return;
  state_.mutedThrough = decision_.muteKey;
  persist();
  redecide();
}

void Engine::dismissNotice() {
  if (rolledBackNotice_.empty()) return;
  rolledBackNotice_.clear();
  publish();
}

void Engine::redecide() {
  if (!manifest_) return publish();
  decision_ = decide({current_, cfg_.channel, p_.platformKey(), *manifest_, state_, p_.now()});
  publish();
}

void Engine::persist() { saveState(path("state.json"), state_); }

// Une installation que le moteur ne sait pas remplacer (paquet .deb/.rpm, dossier non
// inscriptible, app transloquée…) : sans cette annonce, elle n'apprendrait JAMAIS qu'une version
// existe — la règle tait une mineure, et l'échec d'une majeure est muet. Annoncée sans bloquer,
// « Plus tard » la remet au lendemain ; une majeure garde « Ne plus m'avertir ». Le paquet de la
// boutique (MSIX) se tait : le Store le met à jour et la page le dit (`check_msix_update`). Une
// obligatoire garde son propre avertissement (`effectivePrompt`).
bool Engine::manualNotice() const {
  static const std::string kCannot = "cannot-install:";
  if (phase_ != Phase::Failed || !manifest_ || decision_.mandatory || error_.rfind(kCannot, 0) != 0) return false;
  const std::string why = error_.substr(kCannot.size());
  if (why == "msix-managed" || why == "store-managed") return false;
  if (decision_.reason == "major-muted" || decision_.reason == "major-snoozed") return false;
  return !(state_.snoozedVersion == manifest_->version.str() && p_.now() < state_.snoozedUntil);
}

Engine::Json Engine::snapshot() const {
  Json update = nullptr;
  if (manifest_ && decision_.reason != "up-to-date") {
    update = {{"version", manifest_->version.str()}, {"severity", severityName(manifest_->severity)},
              {"mandatory", decision_.mandatory},     {"reason", decision_.reason},
              {"notes", localizedJson(manifest_->notes)}, {"why", localizedJson(manifest_->reason)},
              {"notesUrl", manifest_->notesUrl},       {"install", decision_.install}};
  }
  return {{"enabled", enabled_},
          {"current", current_.str()},
          {"phase", phaseName(phase_)},
          {"progress", progress_ < 0 ? Json(nullptr) : Json(progress_)},
          {"prompt", manualNotice() ? "toast" : promptName(effectivePrompt(decision_, phase_, failures_ > 0))},
          {"manual", manualNotice()},
          {"retrying", failures_ > 0},
          {"canMute", decision_.canMute},
          {"error", error_},
          {"rolledBack", rolledBackNotice_},
          {"update", update}};
}

void Engine::publish() {
  if (emit_) emit_(snapshot());
}

}  // namespace tentacle::update
