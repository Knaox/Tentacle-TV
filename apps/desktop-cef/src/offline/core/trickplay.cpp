// Planches trickplay — `core/trickplay.ts`. Manifeste `item.Trickplay[mediaSourceId][width]` ;
// planches par la route trickplay du backend, sous `meta/<item>/trickplay/<width>/<i>.jpg`, et
// un résumé `trickplay.json` (PascalCase, le `TrickplayInfo` partagé) que le lecteur lit tel quel.

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>

#include "offline/core/files.h"
#include "offline/core/sidecars.h"

namespace tentacle::offline {
namespace {

using OJson = nlohmann::ordered_json;

constexpr int64_t kTargetWidth = 320;  // l'aperçu fait ~320 px dans l'interface
constexpr int64_t kMaxSheets = 10000;
constexpr int64_t kRecheckAfterMs = 30LL * 24 * 60 * 60 * 1000;
constexpr const char* kMarker = "trickplay.none";

/// `Number.parseInt(raw, 10)` : blancs de tête, signe, chiffres ; rien sans chiffre.
std::optional<int64_t> parseIntJs(const std::string& raw) {
  size_t i = 0;
  while (i < raw.size() && std::isspace(static_cast<unsigned char>(raw[i]))) ++i;
  bool negative = false;
  if (i < raw.size() && (raw[i] == '+' || raw[i] == '-')) negative = raw[i++] == '-';
  const size_t start = i;
  int64_t value = 0;
  while (i < raw.size() && std::isdigit(static_cast<unsigned char>(raw[i])) && i - start < 15) value = value * 10 + (raw[i++] - '0');
  if (i == start) return std::nullopt;
  return negative ? -value : value;
}

std::optional<int64_t> intOf(const OJson& value, const char* key) {
  if (!value.is_object() || !value.contains(key)) return std::nullopt;
  const OJson& v = value.at(key);
  if (v.is_number_integer()) return v.get<int64_t>();
  if (v.is_number_float() && std::isfinite(v.get<double>())) return static_cast<int64_t>(std::trunc(v.get<double>()));
  return std::nullopt;
}

std::optional<OJson> infoFromValue(const OJson& value) {
  const auto positive = [&](const char* key) -> std::optional<int64_t> {
    const auto n = intOf(value, key);
    return n && *n > 0 ? n : std::nullopt;
  };
  const auto width = intOf(value, "Width"), height = intOf(value, "Height");
  const auto tw = positive("TileWidth"), th = positive("TileHeight"), count = positive("ThumbnailCount"),
             interval = positive("Interval");
  if (!width || !height || !tw || !th || !count || !interval) return std::nullopt;
  return OJson{{"Width", *width},           {"Height", *height},   {"TileWidth", *tw},
               {"TileHeight", *th},         {"ThumbnailCount", *count}, {"Interval", *interval}};
}

/// Les clés dans l'ordre de JavaScript : les index de tableau (décimaux canoniques < 2³²−1)
/// d'abord, croissants, puis les autres dans l'ordre d'insertion.
std::vector<std::string> jsKeys(const OJson& object) {
  std::vector<std::pair<uint64_t, std::string>> indices;
  std::vector<std::string> others;
  for (const auto& [key, _] : object.items()) {
    const bool digits = !key.empty() && key.size() <= 10 &&
                        std::all_of(key.begin(), key.end(), [](unsigned char c) { return std::isdigit(c) != 0; }) &&
                        (key == "0" || key[0] != '0');
    const uint64_t n = digits ? std::strtoull(key.c_str(), nullptr, 10) : 0;
    if (digits && n < 4294967295ULL) indices.emplace_back(n, key);
    else others.push_back(key);
  }
  std::sort(indices.begin(), indices.end());
  std::vector<std::string> keys;
  for (const auto& [_, key] : indices) keys.push_back(key);
  keys.insert(keys.end(), others.begin(), others.end());
  return keys;
}

std::optional<std::filesystem::path> markerPath(const Volume& volume, const std::string& itemId) {
  try {
    return safeJoin(volume, "meta/" + itemId + "/" + kMarker);
  } catch (...) {
    return std::nullopt;
  }
}

/// Le serveur a répondu et n'a RIEN à offrir — jamais sur un échec réseau.
void markNone(const Volume& volume, const std::string& itemId, int64_t nowMs) {
  const auto target = markerPath(volume, itemId);
  if (!target) return;
  try {
    files::mkdirp(target->parent_path());
    files::writeText(*target, std::to_string(nowMs));
  } catch (...) {
  }
}

}  // namespace

std::optional<nlohmann::ordered_json> pickTrickplayWidth(const OJson& manifest, const std::string& mediaSourceId) {
  if (!manifest.is_object()) return std::nullopt;
  const auto keys = jsKeys(manifest);
  // La source demandée d'abord ; à défaut la première.
  const std::string key = manifest.contains(mediaSourceId) ? mediaSourceId : (keys.empty() ? "" : keys[0]);
  if (keys.empty() || !manifest.at(key).is_object()) return std::nullopt;
  const OJson& widths = manifest.at(key);
  std::optional<std::pair<int64_t, OJson>> best;
  for (const auto& raw : jsKeys(widths)) {
    const auto width = parseIntJs(raw);
    if (!width) continue;
    const auto info = infoFromValue(widths.at(raw));
    if (!info) continue;
    if (!best || std::llabs(*width - kTargetWidth) < std::llabs(best->first - kTargetWidth)) best = std::make_pair(*width, *info);
  }
  if (!best) return std::nullopt;
  return OJson{{"mediaSourceId", key}, {"width", best->first}, {"info", best->second}};
}

Task<int64_t> fetchTrickplay(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId,
                             std::string mediaSourceId, Bytes itemJson, int64_t nowMs) {
  const OJson dto = OJson::parse(itemJson.begin(), itemJson.end(), nullptr, false);
  const OJson* manifest = dto.is_object() && dto.contains("Trickplay") ? &dto.at("Trickplay") : nullptr;
  if (manifest == nullptr || manifest->is_null()) {
    markNone(volume, itemId, nowMs);
    co_return 0;
  }
  const auto choice = pickTrickplayWidth(*manifest, mediaSourceId);
  if (!choice) {
    markNone(volume, itemId, nowMs);
    co_return 0;
  }
  const OJson& info = (*choice)["info"];
  const int64_t perSheet = info["TileWidth"].get<int64_t>() * info["TileHeight"].get<int64_t>();
  const int64_t sheets = perSheet <= 0 ? 0 : (info["ThumbnailCount"].get<int64_t>() + perSheet - 1) / perSheet;
  if (sheets <= 0 || sheets > kMaxSheets) {
    markNone(volume, itemId, nowMs);
    co_return 0;
  }
  const int64_t width = (*choice)["width"].get<int64_t>();
  const std::string source = (*choice)["mediaSourceId"].get<std::string>();
  const std::string folder = "meta/" + itemId + "/trickplay/" + std::to_string(width);
  int64_t fetched = 0;
  for (int64_t index = 0; index < sheets; ++index) {
    std::filesystem::path target;
    try {
      target = safeJoin(volume, folder + "/" + std::to_string(index) + ".jpg");
    } catch (...) {
      continue;
    }
    if (files::exists(target)) {
      ++fetched;
      continue;
    }
    const std::string url = serverUrl + "/api/jellyfin/items/" + itemId + "/trickplay/" + std::to_string(width) + "/" +
                            std::to_string(index) + ".jpg?mediaSourceId=" + source;
    auto pending = fetch(fetchBytes, url, kMaxTileBytes);
    const auto bytes = co_await pending;
    if (!bytes || bytes->empty()) continue;
    try {
      files::mkdirp(target.parent_path());
      files::writeBytes(target, *bytes);
      ++fetched;
    } catch (...) {
      // Une planche manquante dégrade l'aperçu, elle ne casse rien.
    }
  }
  if (fetched > 0) {
    if (const auto marker = markerPath(volume, itemId)) {
      try {
        files::remove(*marker);  // la bibliothèque s'est mise à en produire
      } catch (...) {
      }
    }
    try {
      files::writeText(safeJoin(volume, "meta/" + itemId + "/trickplay.json"), choice->dump());
    } catch (...) {
      // Sans résumé, le lecteur retombe sur l'aperçu serveur.
    }
  }
  co_return fetched;
}

bool trickplayExists(const Volume& volume, const std::string& itemId) {
  return mediaFileExists(volume, "meta/" + itemId + "/trickplay.json");
}

bool trickplayNoneRecently(const Volume& volume, const std::string& itemId, int64_t nowMs) {
  const auto target = markerPath(volume, itemId);
  if (!target) return false;
  try {
    const auto writtenAt = parseIntJs(files::readText(*target));
    return writtenAt && nowMs - *writtenAt < kRecheckAfterMs;
  } catch (...) {
    return false;
  }
}

}  // namespace tentacle::offline
