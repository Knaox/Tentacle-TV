// Stockage et lecture locale — `ipc/downloadsStorage.ts` et `ipc/downloadsPlayback.ts`.
//
// Codes d'erreur STABLES, lus tels quels par l'interface (`api.ts`) : `root-not-empty`,
// `root-not-writable`.

#include "offline/core/args.h"
#include "offline/core/listing.h"
#include "offline/core/playback.h"
#include "offline/core/schema.h"
#include "offline/glue/channels.h"
#include "offline/glue/commands.h"
#include "offline/glue/engine_runtime.h"
#include "offline/glue/runtime.h"

namespace tentacle::offline {
namespace {

/// « Continuer en arrière-plan » : un réglage de CET appareil, allumé par défaut, dans la
/// base locale (clé `background_transfers`, la même que le mobile).
constexpr const char* kBackgroundKey = "background_transfers";

std::string userId(const Json& p) { return args::str(p, "userId", 1, 128); }
std::string itemId(const Json& p) { return args::str(p, "itemId", 1); }

}  // namespace

bool backgroundTransfersOn() {
  try {
    return settingGet(runtime().db(), kBackgroundKey).value_or("") != "0";
  } catch (...) {
    return true;  // base illisible : le défaut
  }
}

void registerStorageChannels(bridge::Registry& registry) {
  addCommand(registry, "downloads_get_root", [](const Json&) { return Json(runtime().volume().root); });
  addCommand(registry, "downloads_set_root", [](const Json& p) {
    return Json(setRoot(runtime().db(), args::str(p, "path", 1)));
  });
  addCommand(registry, "downloads_background_get", [](const Json&) { return Json(backgroundTransfersOn()); });
  addCommand(registry, "downloads_background_set", [](const Json& p) {
    const bool on = args::boolean(p, "on");
    settingSet(runtime().db(), kBackgroundKey, on ? "1" : "0");
    noteBackgroundSetting(on);  // la fermeture le lit sans toucher la base
    return Json(on);
  });
  addCommand(registry, "downloads_disk_free", [](const Json&) { return Json(freeSpace(runtime().volume())); });
  addCommand(registry, "downloads_disk_usage", [](const Json&) { return Json(diskUsage(runtime().db())); });
  addCommand(registry, "downloads_asset_base", [](const Json&) {
    // La racine est résolue ici pour que `media/` et `meta/` existent avant la première image
    // demandée. ⚠️ `token` NON VIDE : la page prendrait une chaîne vide pour un échec.
    runtime().volume();
    return Json{{"base", "tentacle://local"}, {"token", "local"}};
  });
}

void registerPlaybackChannels(bridge::Registry& registry) {
  addCommand(registry, "downloads_local_source", [](const Json& p) {
    const std::string user = userId(p);
    const std::string item = itemId(p);
    Runtime& rt = runtime();
    return localSource(rt.db(), rt.volume(), user, item, nowMs());
  });
  addCommand(registry, "downloads_playback_set", [](const Json& p) {
    const std::string user = userId(p);
    const std::string item = itemId(p);
    const Json position = args::number(p, "positionTicks");
    const bool played = args::boolean(p, "played");
    const bool queueForSync = args::boolean(p, "queueForSync");
    Database& db = runtime().db();
    const int64_t now = nowMs();
    setPlaybackState(db, user, item, position, played, queueForSync, now);
    // L'échéance est posée ICI : le lecteur peut être démonté brutalement, la progression,
    // elle, passe toujours.
    scheduleOnPlayed(db, user, item, now);
    return Json(nullptr);
  });
  addCommand(registry, "downloads_playback_restart", [](const Json& p) {
    restartPlayback(runtime().db(), userId(p), itemId(p), nowMs());
    return Json(nullptr);
  });
  addCommand(registry, "downloads_reports_pending", [](const Json& p) {
    return pendingReports(runtime().db(), userId(p));
  });
  addCommand(registry, "downloads_reports_mark_synced", [](const Json& p) {
    const std::string user = userId(p);
    const std::string item = itemId(p);
    markItemSynced(runtime().db(), user, item, args::integer(p, "upToId"));
    return Json(nullptr);
  });
  addCommand(registry, "downloads_purge_due", [](const Json& p) {
    // `null` explicite quand aucun item n'est exempté de la garde de lecture.
    const auto exempt = args::optStr(p, "itemId");
    Runtime& rt = runtime();
    const int64_t purges = purgeDueClaims(rt.db(), rt.volume(), nowMs(), exempt);
    if (purges > 0) rt.notifyChanged();
    return Json(purges);
  });
}

}  // namespace tentacle::offline
