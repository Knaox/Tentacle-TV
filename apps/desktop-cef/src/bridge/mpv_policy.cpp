#include "mpv_policy.h"

#include <cmath>
#include <map>
#include <set>

namespace bridge::mpv_policy {
namespace {

// Commande → nombre d'arguments au plus. `stop` n'y est pas, comme chez Electron :
// la page démonte le lecteur par `mpv_destroy`.
const std::map<std::string, size_t> kCommands = {
    {"seek", 2}, {"set", 2}, {"cycle", 1}, {"loadfile", 1}, {"sub-add", 2},
};
const std::set<std::string> kPropertyWriters = {"set", "cycle"};

// Sans `hwdec`, `tone-mapping`, `target-prim`, `target-colorspace-hint` d'Electron : la
// chaîne de couleur est à vidéo-HDR (la page ne doit pas pouvoir aplatir le HDR).
const std::set<std::string> kWritable = {
    "pause", "speed", "start", "hr-seek-demuxer-offset", "volume", "mute",
    "ao-volume", "aid", "sid", "sub-visibility",
};

// Options d'init que la page peut poser.
const std::set<std::string> kInitOptions = {
    "hwdec", "keep-open", "hr-seek", "cache", "cache-pause-wait", "cache-pause-initial",
    "demuxer-max-bytes", "demuxer-max-back-bytes", "demuxer-readahead-secs",
    "network-timeout", "stream-lavf-o", "demuxer-lavf-o", "osc", "osd-level", "osd-bar",
    "input-default-bindings", "input-vo-keyboard", "input-cursor", "input-builtin-bindings",
    "input-media-keys", "cursor-autohide", "force-media-title", "audio-client-name", "title",
};

// Fenêtre et sortie : le lecteur de vidéo-HDR les fixe lui-même.
const std::set<std::string> kPlayerOwned = {
    "vo", "gpu-api", "gpu-context", "target-colorspace-hint", "force-window", "border",
    "title-bar", "auto-window-resize", "window-dragging", "native-touch", "wid",
    // `log-file` : un chemin choisi par la page — c'est au natif de dire où écrire.
    "log-file", "msg-level",
};

}  // namespace

std::string toMpvString(const Json& value) {
  if (value.is_boolean()) return value.get<bool>() ? "yes" : "no";
  if (value.is_string()) return value.get<std::string>();
  if (value.is_number_integer()) return std::to_string(value.get<long long>());
  if (value.is_number()) {
    // Pas de `std::to_string(double)` (six décimales, locale) : la forme JSON courte.
    return value.dump();
  }
  return value.dump();
}

FilteredOptions filterInitOptions(const Json& options) {
  FilteredOptions out;
  if (!options.is_object()) return out;
  for (const auto& [name, value] : options.items()) {
    if (kPlayerOwned.count(name)) out.ownedByPlayer.push_back(name);
    else if (kInitOptions.count(name) && (value.is_primitive() && !value.is_null())) out.kept[name] = toMpvString(value);
    else out.refused.push_back(name);
  }
  return out;
}

std::optional<std::string> refuseCommand(const std::string& name, const std::vector<std::string>& args) {
  const auto it = kCommands.find(name);
  if (it == kCommands.end()) return "commande refusee : " + name;
  if (args.size() > it->second) {
    return "commande " + name + " : " + std::to_string(args.size()) + " arguments, " +
           std::to_string(it->second) + " au plus";
  }
  if (!kPropertyWriters.count(name)) return std::nullopt;
  if (args.empty()) return "commande " + name + " : propriete manquante";
  if (!kWritable.count(args[0])) return "propriete refusee : " + args[0];
  return std::nullopt;
}

std::optional<std::string> refuseWrite(const std::string& name) {
  if (kWritable.count(name)) return std::nullopt;
  return "propriete refusee : " + name;
}

Json coerce(const Json& value, const std::string& format) {
  if (value.is_null()) return nullptr;
  if (format == "flag") {
    if (value.is_boolean()) return value;
    if (value.is_string()) return value == "yes" || value == "true";
    return nullptr;
  }
  if (format == "int64" || format == "double") {
    if (value.is_number()) return value;
    if (value.is_string()) {
      try {
        const double n = std::stod(value.get<std::string>());
        return std::isfinite(n) ? Json(n) : Json(nullptr);
      } catch (...) {
        return nullptr;
      }
    }
    return nullptr;
  }
  if (format == "string") return value.is_string() ? value : Json(toMpvString(value));
  return value;
}

}  // namespace bridge::mpv_policy
