// Octave — les formes du pont audio de Tentacle (`audioBridgeContract.ts`),
// en C++, et leur lecture/écriture JSON. Champ pour champ : la page de
// Tentacle les envoie et les reçoit telles quelles.
#pragma once

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace tentacle::music {

struct AudioFormat {
  std::string codec;
  std::optional<std::string> container;
  std::optional<double> sampleRate, bitDepth, bitrate, channels;
  bool lossless = false;
};

struct Track {
  std::string trackKey;
  std::optional<std::string> albumKey;
  std::optional<double> durationMs;
  std::optional<AudioFormat> format;
};

struct Source {
  std::string url;
  std::string origin = "library";  // "library" | "plugin"
  bool complete = true;
  std::optional<double> durationMs;
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
  std::optional<std::string> error;
};

// Lecture tolérante : rend une erreur lisible si un champ requis manque.
std::optional<std::string> parseTrack(const nlohmann::json& j, Track& out);
std::optional<std::string> parseSource(const nlohmann::json& j, Source& out);
std::optional<AudioFormat> parseFormat(const nlohmann::json& j);

nlohmann::json toJson(const AudioFormat& f);
nlohmann::json toJson(const BridgeState& s);

// Un codec sans perte ? (`lossless` du format décodé.)
bool isLossless(const std::string& codec);

}  // namespace tentacle::music
