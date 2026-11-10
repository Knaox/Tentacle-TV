// Photographie d'un item, segments et sous-titres — `snapshot.ts`, `segments.ts`, `subs.ts`.
// Tout passe par le PROXY Tentacle, jeton en en-tête (celui du récupérateur).

#include <algorithm>
#include <array>

#include "offline/core/enqueue.h"
#include "offline/core/files.h"
#include "offline/core/playback.h"
#include "offline/core/sidecars.h"

namespace tentacle::offline {
namespace {

// Alignés sur `useMediaItem` : en lecture locale, ce snapshot REMPLACE le DTO serveur.
constexpr const char* kItemFields =
    "Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,"
    "Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status";
constexpr const char* kParentFields = "Overview,Genres,People,Studios,Taglines,ProviderIds";

// Coroutines : les chaînes passent PAR VALEUR (elles vivent dans le cadre de la coroutine).
Task<std::optional<Bytes>> fetchJson(const FetchBytes& fetchBytes, std::string url, Volume volume, std::string rel) {
  auto bytes = co_await fetch(fetchBytes, url, kMaxJsonBytes);
  if (!bytes) co_return std::nullopt;
  co_return saveBytes(volume, rel, *bytes) ? bytes : std::nullopt;
}

/// La bibliothèque de l'item : le `CollectionFolder` de PREMIER niveau (le dernier en remontant).
Task<bool> setLibraryFromAncestors(const FetchBytes& fetchBytes, Database& db, std::string base, std::string itemId) {
  const auto bytes = co_await fetch(fetchBytes, base + "/Items/" + itemId + "/Ancestors", kMaxJsonBytes);
  if (!bytes) co_return false;
  const Json ancestors = parseJson(*bytes);
  if (!ancestors.is_array()) co_return false;
  for (auto it = ancestors.rbegin(); it != ancestors.rend(); ++it) {
    if (asString(jsonField(*it, "Type")) != std::optional<std::string>("CollectionFolder")) continue;
    const auto id = asString(jsonField(*it, "Id"));
    if (!id) continue;
    setLibrary(db, itemId, {*id, asString(jsonField(*it, "Name")), asString(jsonField(*it, "CollectionType"))});
    co_return true;
  }
  co_return false;
}

bool plausibleContract(const Json& raw) {
  if (!raw.is_object()) return false;
  const Json* version = jsonField(raw, "version");
  const Json* itemId = jsonField(raw, "itemId");
  const Json* segments = jsonField(raw, "segments");
  return version != nullptr && version->is_number() && version->get<double>() == 1.0 && itemId != nullptr &&
         itemId->is_string() && segments != nullptr && segments->is_array();
}

}  // namespace

CallbackAwaiter<std::optional<Bytes>> fetch(const FetchBytes& fetchBytes, const std::string& url, int64_t maxBytes) {
  return CallbackAwaiter<std::optional<Bytes>>(
      [fetchBytes, url, maxBytes](std::function<void(std::optional<Bytes>)> done) { fetchBytes(url, maxBytes, std::move(done)); });
}

Task<void> snapshot(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, MetaSpec spec, int64_t nowMs) {
  const std::string base = serverUrl + "/api/jellyfin";
  const std::string dir = "meta/" + spec.itemId;
  std::vector<std::string> succeeded;

  const auto itemJson =
      co_await fetchJson(fetchBytes, base + "/Items/" + spec.itemId + "?fields=" + kItemFields, volume, dir + "/item.json");
  if (itemJson) succeeded.push_back("item");
  if (spec.seriesId) {
    const auto ok = co_await fetchJson(fetchBytes, base + "/Items/" + *spec.seriesId + "?fields=" + kParentFields, volume,
                                       dir + "/series.json");
    if (ok) succeeded.push_back("series");
  }
  if (spec.seasonId) {
    const auto ok = co_await fetchJson(fetchBytes, base + "/Items/" + *spec.seasonId + "?fields=" + kParentFields, volume,
                                       dir + "/season.json");
    if (ok) succeeded.push_back("season");
  }
  if (itemJson) {
    // Le DTO frais fait autorité sur les numéros (répare une mise en file d'avant le v5).
    applyEpisodeNumbers(db, spec.itemId, *itemJson);
    const std::string mediaSourceId = firstMediaSourceId(db, spec.itemId).value_or(spec.itemId);
    const int64_t sheets = co_await fetchTrickplay(fetchBytes, serverUrl, volume, spec.itemId, mediaSourceId, *itemJson, nowMs);
    if (sheets > 0) succeeded.push_back("trickplay");
  }
  // L'affiche vient de l'item ; la bannière et le logo de la SÉRIE pour un épisode.
  const std::string visual = spec.seriesId.value_or(spec.itemId);
  const std::vector<std::array<std::string, 3>> images = {
      {base + "/Items/" + spec.itemId + "/Images/Primary?maxWidth=600&quality=90&format=Jpg", dir + "/primary.jpg", "primary"},
      {base + "/Items/" + visual + "/Images/Backdrop?maxWidth=1280&quality=90&format=Jpg", dir + "/backdrop.jpg", "backdrop"},
      {base + "/Items/" + visual + "/Images/Logo?maxWidth=800&format=Png", dir + "/logo.png", "logo"},
  };
  for (const auto& [url, rel, name] : images) {
    const auto bytes = co_await fetch(fetchBytes, url, kMaxJsonBytes);
    if (bytes && !bytes->empty() && saveBytes(volume, rel, *bytes)) succeeded.push_back(name);
  }
  if (spec.seriesId) {
    const auto bytes = co_await fetch(
        fetchBytes, base + "/Items/" + *spec.seriesId + "/Images/Primary?maxWidth=600&quality=90&format=Jpg", kMaxJsonBytes);
    if (bytes && saveBytes(volume, dir + "/series-primary.jpg", *bytes)) succeeded.push_back("seriesPrimary");
  }
  if (co_await setLibraryFromAncestors(fetchBytes, db, base, spec.itemId)) succeeded.push_back("library");
  // Les segments viennent du résolveur du backend, pas du proxy Jellyfin.
  if (co_await fetchSegments(fetchBytes, serverUrl, volume, spec.itemId)) succeeded.push_back("segments");
  markSnapshotDone(db, spec.itemId, Json{{"ok", succeeded}}.dump(), nowMs);
}

Task<bool> fetchSegments(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId) {
  const auto bytes = co_await fetch(fetchBytes, serverUrl + "/api/playback/segments/" + itemId, kMaxJsonBytes);
  if (!bytes) co_return false;
  if (!plausibleContract(parseJson(*bytes))) co_return false;
  co_return saveBytes(volume, "meta/" + itemId + "/segments.json", *bytes);
}

bool segmentsNeedRefresh(const Volume& volume, const std::string& itemId) {
  const std::string rel = "meta/" + itemId + "/segments.json";
  if (!mediaFileExists(volume, rel)) return false;
  try {
    const Json raw = parseJsonText(files::readText(safeJoin(volume, rel)));
    const Json* pending = jsonField(raw, "analysisPending");
    return plausibleContract(raw) && pending != nullptr && pending->is_boolean() && pending->get<bool>();
  } catch (...) {
    return false;
  }
}

Task<int64_t> fetchSubtitles(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId,
                             std::string mediaSourceId, std::vector<SubtitleSpec> specs,
                             std::function<void(const SubtitleSpec&, const std::string&)> onSkipped) {
  const auto skipped = [&](const SubtitleSpec& spec, const char* reason) {
    if (onSkipped) onSkipped(spec, reason);
  };
  int64_t fetched = 0;
  for (const auto& spec : specs) {
    if ((spec.format != "srt" && spec.format != "ass" && spec.format != "vtt") || spec.index < 0) {
      skipped(spec, "format");
      continue;
    }
    std::filesystem::path target;
    try {
      target = safeJoin(volume, subtitleRelPath(itemId, spec));
    } catch (...) {
      skipped(spec, "path");
      continue;
    }
    if (files::exists(target)) {
      ++fetched;  // déjà là : la réparation peut rappeler sans coût
      continue;
    }
    const std::string url = serverUrl + "/api/jellyfin/Videos/" + itemId + "/" + mediaSourceId + "/Subtitles/" +
                            std::to_string(spec.index) + "/Stream." + spec.format;
    const auto bytes = co_await fetch(fetchBytes, url, kMaxSubtitleBytes);
    if (!bytes || bytes->empty()) {
      skipped(spec, "fetch");
      continue;
    }
    try {
      files::mkdirp(target.parent_path());
      files::writeBytes(target, *bytes);
      ++fetched;
    } catch (...) {
      skipped(spec, "write");  // disque plein ou droits : le média reste lisible
    }
  }
  co_return fetched;
}

}  // namespace tentacle::offline
