#include "offline/core/enqueue.h"

#include <regex>
#include <stdexcept>

#include "offline/core/args.h"
#include "offline/core/files.h"
#include "offline/core/listing.h"
#include "offline/core/meta.h"
#include "offline/core/queue.h"
#include "offline/core/rows.h"
#include "offline/core/store.h"

namespace tentacle::offline {
namespace {

std::optional<int64_t> optInt(const Json& item, const char* key) {
  const Json value = args::optNumber(item, key);
  return value.is_null() ? std::nullopt : asInteger(&value);
}

bool validId(const std::string& value) {
  static const std::regex pattern("^[A-Za-z0-9-]+$");
  return !value.empty() && value.size() <= 64 && std::regex_match(value, pattern);
}

bool validExt(const std::string& value) {
  static const std::regex pattern("^[a-z0-9]+$");
  return !value.empty() && value.size() <= 5 && std::regex_match(value, pattern);
}

}  // namespace

EnqueueItem enqueueItemFromJson(const Json& j) {
  EnqueueItem it;
  it.itemId = args::str(j, "itemId");
  it.mediaSourceId = args::str(j, "mediaSourceId");
  it.variant = args::oneOf(j, "variant", {"original", "light"});
  it.preset = args::optStr(j, "preset");
  it.containerExt = args::str(j, "containerExt");
  it.expectedSize = optInt(j, "expectedSize");
  it.estimatedSize = optInt(j, "estimatedSize");
  it.kind = args::oneOf(j, "kind", {"movie", "episode"});
  it.seriesId = args::optStr(j, "seriesId");
  it.seasonId = args::optStr(j, "seasonId");
  it.libraryId = args::optStr(j, "libraryId");
  it.runtimeTicks = optInt(j, "runtimeTicks");
  it.title = args::optStr(j, "title");
  it.seriesName = args::optStr(j, "seriesName");
  it.indexNumber = optInt(j, "indexNumber");
  it.parentIndexNumber = optInt(j, "parentIndexNumber");
  it.autoDeleteAfterWatch = args::boolean(j, "autoDeleteAfterWatch");
  it.autoDeleteDelayMinutes = args::optInteger(j, "autoDeleteDelayMinutes").value_or(0);
  it.audioStreamIndex = optInt(j, "audioStreamIndex");
  it.burnSubtitleIndex = optInt(j, "burnSubtitleIndex");
  if (const Json* subs = args::field(j, "subtitles"); subs != nullptr && !subs->is_null()) {
    if (!subs->is_array()) throw args::Invalid("subtitles : tableau attendu");
    std::vector<SubtitleSpec> list;
    for (const Json& s : *subs) {
      list.push_back({args::integer(s, "index"), args::oneOf(s, "format", {"srt", "ass", "vtt"}), args::str(s, "langTag")});
    }
    it.subtitles = std::move(list);
  }
  return it;
}

void validateBatch(const std::vector<EnqueueItem>& items) {
  if (items.empty()) throw std::runtime_error("empty-batch");
  for (const auto& item : items) {
    const bool ok = validId(item.itemId) && validId(item.mediaSourceId) && validExt(item.containerExt) &&
                    (item.variant == "original" || item.variant == "light") &&
                    (item.kind == "movie" || item.kind == "episode") && (!item.preset || validExt(*item.preset));
    if (!ok) throw std::runtime_error("invalid-item");
  }
}

std::string mediaRelPath(const EnqueueItem& item) {
  if (item.variant == "original") {
    return "media/" + item.itemId + "/original-" + item.mediaSourceId + "." + item.containerExt;
  }
  return "media/" + item.itemId + "/light-" + item.mediaSourceId + "-" + item.preset.value_or("p720") + ".mp4";
}

Json enqueueBatch(Database& db, const std::string& userId, const std::vector<EnqueueItem>& items, int64_t freeBytes,
                  int64_t nowMs, int64_t margin) {
  validateBatch(items);
  // Un fichier existant et non annulé ne compte pas : on va s'y accrocher.
  int64_t needed = pendingBytes(db);
  for (const auto& item : items) {
    const auto existing = findFile(db, {item.itemId, item.mediaSourceId, item.variant, item.preset});
    if (!existing || existing->status == "canceled") needed += item.estimatedSize.value_or(item.expectedSize.value_or(0));
  }
  if (needed > 0 && !hasCapacity(needed, freeBytes, margin)) {
    return {{"accepted", false}, {"neededBytes", needed}, {"freeBytes", freeBytes}, {"fileIds", Json::array()}};
  }

  Json fileIds = Json::array();
  for (const auto& item : items) {
    upsertItemMeta(db,
                   {item.itemId, item.kind, item.seriesId, item.seasonId, item.libraryId, item.runtimeTicks, item.title,
                    item.seriesName, item.indexNumber, item.parentIndexNumber},
                   nowMs);
    // L'Allégé n'a pas de taille exacte, mais son ESTIMATION donne un total à la barre ;
    // jamais pour l'Original, dont la taille serveur sert de contrôle d'intégrité.
    const auto expected = item.expectedSize ? item.expectedSize : (item.variant == "light" ? item.estimatedSize : std::nullopt);
    const ClaimOutcome outcome = claimOrCreateFile(
        db, {{item.itemId, item.mediaSourceId, item.variant, item.preset}, userId, mediaRelPath(item), expected,
             item.autoDeleteAfterWatch, nowMs});
    std::optional<std::string> subtitlesJson;
    if (item.subtitles && !item.subtitles->empty()) {
      // `JSON.stringify` d'Electron : clés dans l'ordre du schéma (index, format, langTag).
      nlohmann::ordered_json list = nlohmann::ordered_json::array();
      for (const auto& s : *item.subtitles) list.push_back({{"index", s.index}, {"format", s.format}, {"langTag", s.langTag}});
      subtitlesJson = list.dump();
    }
    setLightParams(db, outcome.fileId, item.audioStreamIndex, item.burnSubtitleIndex, subtitlesJson);
    // Même sur un claim préexistant : l'intention exprimée dans le dialogue gagne.
    if (item.autoDeleteAfterWatch) {
      setAutoDelete(db, userId, outcome.fileId, true, item.autoDeleteDelayMinutes, nowMs);
    }
    fileIds.push_back(outcome.fileId);
  }
  return {{"accepted", true}, {"neededBytes", needed}, {"freeBytes", freeBytes}, {"fileIds", fileIds}};
}

bool applyEpisodeNumbers(Database& db, const std::string& itemId, const std::vector<uint8_t>& itemJson) {
  const Json dto = parseJson(itemJson);
  const auto index = asInteger(jsonField(dto, "IndexNumber"));
  const auto parent = asInteger(jsonField(dto, "ParentIndexNumber"));
  if (!index && !parent) return false;
  db.prepare(
        "UPDATE item_meta\n"
        "        SET index_number = COALESCE(?, index_number),\n"
        "            parent_index_number = COALESCE(?, parent_index_number)\n"
        "      WHERE item_id = ?")
      .run(index, parent, itemId);
  return true;
}

int64_t backfillEpisodeNumbers(Database& db, const Volume& volume) {
  std::vector<std::string> ids;
  for (const Row& row : db.prepare(
                              "SELECT item_id FROM item_meta\n"
                              "        WHERE kind = 'episode' AND (index_number IS NULL OR parent_index_number IS NULL)")
                            .all()) {
    ids.push_back(text(row, "item_id"));
  }
  int64_t filled = 0;
  for (const auto& itemId : ids) {
    std::vector<uint8_t> bytes;
    try {
      bytes = files::readBytes(safeJoin(volume, "meta/" + itemId + "/item.json"));
    } catch (...) {
      continue;
    }
    if (applyEpisodeNumbers(db, itemId, bytes)) ++filled;
  }
  return filled;
}

}  // namespace tentacle::offline
