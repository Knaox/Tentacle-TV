// Sorties proposées (`audioOutputs.ts`), noms de codecs du contrat et format décodé
// (`audioFormat.ts`) — règles pures d'Electron.
#include <algorithm>
#include <set>

#include "music/audio_options.h"

namespace tentacle::music {
namespace {

using json = nlohmann::json;

bool startsWith(const std::string& s, const char* prefix) { return s.rfind(prefix, 0) == 0; }

std::string lower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
  return s;
}

bool contains(const std::optional<std::string>& s, const char* what) {
  return s && lower(*s).find(what) != std::string::npos;
}

const std::set<std::string> kLossless = {"flac", "alac", "wav", "aiff", "pcm", "dsd", "ape", "wavpack", "truehd", "tta"};

}  // namespace

bool exclusiveCapable(Platform platform, const std::string& name) {
  if (name == "auto") return true;
  if (startsWith(name, "coreaudio/")) return platform == Platform::Darwin;
  if (startsWith(name, "wasapi/")) return platform == Platform::Win32;
  if (startsWith(name, "pipewire/")) return platform == Platform::Linux;
  if (startsWith(name, "alsa/")) return platform == Platform::Linux && startsWith(name, "alsa/hw:");
  return false;
}

json parseOutputs(Platform platform, const json& deviceList) {
  json raw = deviceList;
  if (raw.is_string()) raw = json::parse(raw.get<std::string>(), nullptr, false);
  // La famille qui fait le travail sur chaque système : jamais deux fois la même sortie.
  const std::vector<std::string> families = platform == Platform::Darwin  ? std::vector<std::string>{"coreaudio/"}
                                            : platform == Platform::Win32 ? std::vector<std::string>{"wasapi/"}
                                                                          : std::vector<std::string>{"pipewire/", "pulse/", "alsa/"};
  std::vector<std::pair<std::string, std::string>> kept;
  if (raw.is_array()) {
    for (const auto& d : raw) {
      if (!d.is_object() || !d.contains("name") || !d["name"].is_string() || !d.contains("description") ||
          !d["description"].is_string())
        continue;
      const std::string name = d["name"].get<std::string>();
      const bool ours = name == "auto" || std::any_of(families.begin(), families.end(), [&](const auto& f) { return startsWith(name, f.c_str()); });
      if (ours) kept.emplace_back(name, d["description"].get<std::string>());
    }
  }
  // PipeWire présent : PulseAudio n'en est que l'émulation, les mêmes sorties en double.
  const bool pipewire = std::any_of(kept.begin(), kept.end(), [](const auto& d) { return startsWith(d.first, "pipewire/"); });
  json out = json::array();
  bool hasAuto = false;
  for (const auto& [name, description] : kept) {
    if (pipewire && startsWith(name, "pulse/")) continue;
    json o = {{"id", name}, {"name", description}, {"exclusiveCapable", exclusiveCapable(platform, name)}};
    if (name == "auto") {
      hasAuto = true;
      out.insert(out.begin(), o);
    } else {
      out.push_back(o);
    }
  }
  if (!hasAuto) out.insert(out.begin(), json{{"id", "auto"}, {"name", ""}, {"exclusiveCapable", exclusiveCapable(platform, "auto")}});
  return out;
}

std::optional<std::string> contractCodec(const std::string& decoder, const std::optional<std::string>& container) {
  const std::string d = lower(decoder);
  if (startsWith(d, "dsd_")) return "dsd";
  if (startsWith(d, "pcm_")) {
    if (contains(container, "aiff")) return "aiff";
    if (contains(container, "wav")) return "wav";
    return container ? "pcm" : "wav";
  }
  if (d == "mp3float" || d == "mp3" || d == "mp3adu") return "mp3";
  if (d == "libopus" || d == "opus") return "opus";
  if (d == "aac" || d == "aac_fixed" || d == "aac_at" || d == "aac_latm") return "aac";
  if (d == "libvorbis" || d == "vorbis") return "vorbis";
  static const std::set<std::string> same = {"flac", "alac", "ape", "wavpack", "truehd", "tta"};
  if (same.count(d)) return d;
  return std::nullopt;
}

std::vector<std::string> codecsFromDecoderList(const json& list) {
  json raw = list;
  if (raw.is_string()) raw = json::parse(raw.get<std::string>(), nullptr, false);
  std::set<std::string> found;
  if (raw.is_array())
    for (const auto& d : raw) {
      if (!d.is_object() || !d.contains("codec") || !d["codec"].is_string()) continue;
      const auto name = contractCodec(d["codec"].get<std::string>());
      if (name && *name != "pcm") found.insert(*name);
    }
  return {found.begin(), found.end()};
}

std::optional<AudioFormat> decodedFormat(const DecodedProps& props, const std::optional<AudioFormat>& announced) {
  const auto codec = props.codecName ? contractCodec(*props.codecName, props.fileFormat) : std::nullopt;
  if (!codec) return announced;
  // La profondeur de bits : celle de la bibliothèque (le décodeur rend du s32 ou du flottant).
  const bool sameCodec = announced && announced->codec == *codec;
  AudioFormat f;
  f.codec = *codec;
  f.container = props.fileFormat ? props.fileFormat : (announced ? announced->container : std::nullopt);
  f.sampleRate = props.sampleRate ? props.sampleRate : (announced ? announced->sampleRate : std::nullopt);
  f.bitDepth = sameCodec ? announced->bitDepth : std::nullopt;
  f.bitrate = props.bitrate && *props.bitrate > 0 ? std::optional<double>(std::round(*props.bitrate))
                                                  : (announced ? announced->bitrate : std::nullopt);
  f.channels = props.channels ? props.channels : (announced ? announced->channels : std::nullopt);
  f.lossless = kLossless.count(*codec) > 0;
  return f;
}

json mpvCapabilities(const std::vector<std::string>& codecs) {
  // Gapless, bascule à chaud et sortie exclusive : mesurés au banc d'Electron (macOS) ;
  // WASAPI et PipeWire suivent le même code, non vérifiés sur machine.
  return {{"engine", "mpv"},  {"gapless", true}, {"exclusiveOutput", true}, {"replayGain", true},
          {"codecs", codecs}, {"hotSwap", true}};
}

}  // namespace tentacle::music
