// Octave — l'état du moteur tel que la page le reçoit (`AudioBridgeState`), dérivé de ce que
// mpv dit et de ce que le moteur sait ; et les commandes mpv de chaque opération de la file.
// Port pur de `audioEngineState.ts`, `audioEngineOps.ts`, `audioEngineOutput.ts` (chaîne).
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "music/audio_backend.h"
#include "music/audio_queue.h"
#include "music/audio_types.h"

namespace tentacle::music {

struct LiveProps {
  std::optional<double> timePos;
  bool eofReached = false;
  bool pausedForCache = false;
  std::optional<std::string> codecName, fileFormat;
  std::optional<double> sampleRate, channels, bitrate, mpvDuration;
  std::optional<double> cacheTime;  // dernier instant en cache (chronologie de l'entrée)
};

struct EngineFlags {
  bool wantPaused = false;
  bool awaitingRestart = false;  // (re)chargé, pas encore de son (`playback-restart`)
  bool reloading = false;        // fin provisoire : une relecture est prévue
  bool ended = false;
  std::optional<std::string> error;
};
inline EngineFlags freshFlags(bool awaitingRestart) {
  EngineFlags f;
  f.awaitingRestart = awaitingRestart;
  return f;
}

struct Settings {
  double volume = 1;
  bool muted = false;
  std::optional<std::string> deviceId;
  bool exclusive = false;
  std::string replayGain = "auto";
};

std::string deriveStatus(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags);
// La durée MESURÉE par mpv l'emporte (fichier complet, hors EDL), sinon celle de la source, du titre.
std::optional<double> durationOf(const EntryPtr& current, const LiveProps& props);
BridgeState buildState(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags, const Settings& settings);
const Observed& observedProperties();
LiveProps applyProperty(LiveProps props, const std::string& name, const PropValue& value);

// --- Opérations de la file → commandes mpv ---------------------------------------------
Options entryOptions(const QueueEntry& entry, const std::string& replayGainMode);
std::string entryUrl(const QueueEntry& entry);
std::vector<std::string> opArgs(const QueueOp& op, const std::string& replayGainMode);
std::vector<std::vector<std::string>> currentGainCommands(const EntryPtr& entry, const std::string& mode);
// Volume, sourdine, ReplayGain : met `settings` à jour et rend les commandes.
std::vector<std::vector<std::string>> settingCommands(const Control& c, Settings& settings, const EntryPtr& current);
// La chaîne `af` : rien en mode exclusif, la mesure seule, ou la mesure et le gain du fondu.
std::string chainFor(bool exclusive, const std::optional<std::string>& expr);

}  // namespace tentacle::music
