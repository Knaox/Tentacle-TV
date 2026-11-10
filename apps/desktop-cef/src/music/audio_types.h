// Octave — les formes du pont audio de Tentacle (`audioBridgeContract.ts`), en C++, et leur
// lecture/écriture JSON. Champ pour champ : la page de Tentacle les envoie et les reçoit
// telles quelles. La LECTURE suit le schéma zod d'Electron (`ipc/audio.ts`) : un champ hors
// bornes rejette la commande au lieu d'être deviné.
#pragma once

#include <map>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace tentacle::music {

struct AudioFormat {
  std::string codec;
  std::optional<std::string> container;
  std::optional<double> sampleRate, bitDepth, bitrate, channels;
  bool lossless = false;
  bool operator==(const AudioFormat&) const = default;
};

struct ReplayGainValues {
  std::optional<double> trackGainDb, trackPeak, albumGainDb, albumPeak;
  bool operator==(const ReplayGainValues&) const = default;
};

struct Track {
  std::string trackKey;
  std::optional<std::string> albumKey;
  std::optional<double> durationMs;
  std::optional<AudioFormat> format;
  bool operator==(const Track&) const = default;
};

// Un flux que CET appareil lit en direct (requêtes déléguées d'une extension).
struct DirectStream {
  std::string url;
  std::optional<double> expiresAt;
  bool operator==(const DirectStream&) const = default;
};

// La copie gardée hors ligne par ce compte : la coquille la cherche dans SA base.
struct KeptRef {
  std::string userId;
  std::optional<std::string> trackKey;
  bool operator==(const KeptRef&) const = default;
};

struct Source {
  std::string url;
  std::string origin = "library";  // "library" | "plugin"
  bool complete = true;
  std::optional<double> sizeBytes;
  std::optional<double> durationMs;
  std::optional<ReplayGainValues> replayGain;
  std::optional<double> expiresAt;
  std::optional<DirectStream> direct;
  std::optional<KeptRef> kept;
  // Transition douce : la courbe d'entrée du titre qui ARRIVE (`FadedSource` d'Electron).
  // Jamais lue de la page.
  std::optional<double> fadeInS;
  bool operator==(const Source&) const = default;
};

// `audio_engine_start`.
struct StartSettings {
  std::string serverOrigin;
  std::map<std::string, std::string> headers;
  double volume = 1.0;
  bool muted = false;
  std::string replayGain = "auto";  // off | track | album | auto
  std::optional<std::string> deviceId;
  bool exclusive = false;
};

// `audio_control` : pause | resume | stop | seek(value ms) | volume(0..1) | muted(flag) |
// replayGain(mode) | crossfade(ms).
struct Control {
  std::string action;
  double value = 0;
  bool flag = false;
  std::string mode;
  static Control of(std::string action, double value = 0) {
    Control c;
    c.action = std::move(action);
    c.value = value;
    return c;
  }
};

// Les statuts de la page : idle | loading | playing | paused | buffering | ended | error.
struct BridgeState {
  std::string status = "idle";
  std::optional<std::string> trackKey;
  double positionMs = 0;
  std::optional<double> durationMs;
  double volume = 1;
  bool muted = false;
  std::optional<AudioFormat> format;
  std::optional<std::string> deviceId;
  bool exclusive = false;
  std::optional<std::string> error;
};

// Lecture au schéma d'Electron : rend le motif du refus, sinon rien.
std::optional<std::string> parseTrack(const nlohmann::json& j, Track& out);
std::optional<std::string> parseSource(const nlohmann::json& j, Source& out);
std::optional<std::string> parseStart(const nlohmann::json& j, StartSettings& out);
std::optional<std::string> parseControl(const nlohmann::json& j, Control& out);
std::optional<AudioFormat> parseFormat(const nlohmann::json& j);
bool validReplayGainMode(const std::string& mode);

nlohmann::json toJson(const AudioFormat& f);
nlohmann::json toJson(const BridgeState& s);
nlohmann::json toJson(const Control& c);

}  // namespace tentacle::music
