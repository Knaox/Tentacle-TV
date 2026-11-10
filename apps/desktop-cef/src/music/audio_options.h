// Octave — les RÈGLES PURES du moteur audio, portées d'Electron fichier par fichier (le
// POURQUOI de chaque règle est dans le fichier d'origine, cité) : options de l'instance et
// des fichiers (`audioOptions.ts`), sortie (`audioOutputs.ts`), ReplayGain
// (`replayGain.ts`), fichier qui grandit (`partialSource.ts`), sources (`audioSources.ts`),
// niveau (`audioLevel.ts`), formats (`audioFormat.ts`). Testées en C++
// (`tests/music_rules_tests.cpp`) avec les cas des tests d'Electron.
#pragma once

#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "music/audio_backend.h"
#include "music/audio_types.h"

namespace tentacle::music {

enum class Platform { Darwin, Win32, Linux };
Platform currentPlatform();

// Options ORDONNÉES (l'ordre d'écriture compte dans `loadfile`) ; `setOption` remplace.
void setOption(Options& options, const std::string& key, const std::string& value);
const std::string* findOption(const Options& options, const std::string& key);

// Mode muet des bancs (`--mute` / `TENTACLE_MUTE=1`) : propre à CEF (règle du lot).
bool forcedSilence();

// --- audioOptions.ts --------------------------------------------------------------------
Options audioInstanceOptions();
Options outputOptions(Platform platform, const std::optional<std::string>& deviceId, bool exclusive);
Options partialStreamOptions(bool complete);
// `clé=valeur,…` ; une valeur hors de [A-Za-z0-9._+-:/] part en `%octets%valeur`.
std::string formatFileOptions(const Options& options);
std::string edlFrom(const std::string& url, double fromS);
double swapPoint(double positionS, std::optional<double> sampleRate, double leadS);
// Les options de naissance (sans les en-têtes : posés par `change-list`, `headerLines`).
Options startOptions(Platform platform, const StartSettings& start, const Options& extra);
// Un en-tête par élément : une virgule ne coupe plus la valeur. Refus : nom hors
// [A-Za-z0-9-], valeur avec retour à la ligne.
std::optional<std::string> headerLines(const std::map<std::string, std::string>& headers, std::vector<std::string>& out);
std::string fixed6(double s);

// --- audioLevel.ts ----------------------------------------------------------------------
extern const char* const kLevelLabel;
extern const std::string kLevelFilter;
extern const std::string kLevelProperty;
constexpr double kSilenceDb = -120;
Options levelFilterOption(bool exclusive);
std::optional<double> parseLevel(const std::optional<std::string>& raw);

// --- replayGain.ts ----------------------------------------------------------------------
std::string effectiveGainMode(const std::string& mode, const std::optional<std::string>& albumKey,
                              const std::vector<std::optional<std::string>>& neighbours);
std::optional<double> gainFromSource(const std::string& mode, const ReplayGainValues& rg);
Options replayGainOptions(const std::string& mode, const std::optional<ReplayGainValues>& rg);

// --- partialSource.ts -------------------------------------------------------------------
constexpr double kPartialEndToleranceMs = 1500;
constexpr int kMaxStalledReloads = 4;
struct EndContext {
  bool complete = false;
  std::optional<double> durationMs;
  double positionMs = 0;
  int stalledReloads = 0;
};
bool isRealEnd(const EndContext& ctx);
bool cachedToEnd(std::optional<double> cacheTimeS, double offsetS, std::optional<double> durationMs);
int reloadDelayMs(int attempt);
bool progressed(std::optional<double> previousMs, double positionMs);

// --- audioSources.ts --------------------------------------------------------------------
// L'origine `scheme://hôte[:port]` d'une adresse http(s) sans identifiants, ou rien.
std::optional<std::string> httpOrigin(const std::string& url);
std::optional<std::string> refuseSource(const std::string& url, const std::optional<std::string>& serverOrigin);
bool expiresSoon(const Source& source, double nowMs, double marginMs);
Source servedSource(std::map<std::string, Source>& overrides, const std::string& trackKey, const Source& given);

// --- audioOutputs.ts / audioFormat.ts ---------------------------------------------------
bool exclusiveCapable(Platform platform, const std::string& deviceName);
nlohmann::json parseOutputs(Platform platform, const nlohmann::json& deviceList);
std::optional<std::string> contractCodec(const std::string& decoder, const std::optional<std::string>& container = std::nullopt);
std::vector<std::string> codecsFromDecoderList(const nlohmann::json& list);
struct DecodedProps {
  std::optional<std::string> codecName, fileFormat;
  std::optional<double> sampleRate, channels, bitrate;
};
std::optional<AudioFormat> decodedFormat(const DecodedProps& props, const std::optional<AudioFormat>& announced);
nlohmann::json mpvCapabilities(const std::vector<std::string>& codecs);

}  // namespace tentacle::music
