#include "update/decision.h"

#include <algorithm>

namespace tentacle::update {

const char* promptName(Prompt p) {
  switch (p) {
    case Prompt::None: return "none";
    case Prompt::Toast: return "toast";
    case Prompt::Blocking: return "blocking";
  }
  return "none";
}

const char* phaseName(Phase p) {
  switch (p) {
    case Phase::Idle: return "idle";
    case Phase::Checking: return "checking";
    case Phase::Downloading: return "downloading";
    case Phase::Verifying: return "verifying";
    case Phase::Staging: return "staging";
    case Phase::Ready: return "ready";
    case Phase::Applying: return "applying";
    case Phase::Failed: return "failed";
  }
  return "idle";
}

Decision decide(const DecisionInput& in) {
  const Manifest& m = in.manifest;
  const DeviceState& s = in.state;
  Decision d;

  if (m.channel != in.channel) return d.reason = "other-channel", d;
  if (m.issuedAt < s.lastIssuedAt) return d.reason = "stale-manifest", d;
  if (m.version <= in.current) return d.reason = "up-to-date", d;

  d.mandatory = m.severity == Severity::Critical || (m.minVersion && in.current < *m.minVersion);
  const bool rolledBack =
      std::find(s.badVersions.begin(), s.badVersions.end(), m.version.str()) != s.badVersions.end();
  const bool hasAsset = m.assets.count(in.platformKey) > 0;

  if (rolledBack || !hasAsset) {
    // Impossible de l'installer ici. Une obligatoire le DIT (sans bloquer : on ne bloque
    // jamais une app qu'on ne sait pas mettre à jour) ; une autre se tait.
    d.reason = rolledBack ? "rolled-back" : "no-asset";
    d.prompt = d.mandatory ? Prompt::Toast : Prompt::None;
    return d;
  }

  d.install = true;
  if (d.mandatory) {
    d.prompt = Prompt::Blocking;
    d.reason = m.severity == Severity::Critical ? "critical" : "below-min";
    return d;
  }

  // Traverse-t-on une majeure ? Elle-même, ou une majeure publiée entre-temps
  // (`majorSince`) que cet appareil n'a jamais reçue.
  const bool selfMajor = m.severity == Severity::Major;
  const bool crossesMajor = selfMajor || (m.majorSince && in.current < *m.majorSince);
  if (!crossesMajor) return d.reason = "minor", d;

  const Version ref = selfMajor ? m.version : *m.majorSince;
  d.muteKey = ref.str();
  if (auto muted = Version::parse(s.mutedThrough); muted && ref <= *muted) return d.reason = "major-muted", d;
  if (s.snoozedVersion == d.muteKey && in.now < s.snoozedUntil) return d.reason = "major-snoozed", d;
  d.prompt = Prompt::Toast;
  d.canMute = true;
  d.reason = "major";
  return d;
}

Prompt effectivePrompt(const Decision& d, Phase phase, bool retrying) {
  // Une majeure dont le téléchargement échoue se tait : nouvel essai plus tard, sans bruit.
  if (phase == Phase::Failed && !d.mandatory) return Prompt::None;
  if (d.prompt != Prompt::Blocking) return d.prompt;
  switch (phase) {
    case Phase::Ready:
    case Phase::Applying: return Prompt::Blocking;
    case Phase::Downloading:
    case Phase::Verifying:
    case Phase::Staging: return retrying ? Prompt::Toast : Prompt::Blocking;
    default: return Prompt::Toast;  // hors ligne, archive refusée… : avertir sans bloquer
  }
}

}  // namespace tentacle::update
