// Ce que la page lit des titres gardés — `downloads_list`, `downloads_state_for_item`,
// `downloads_set_auto_delete` (`ipc/downloadsEngine.ts`) et la musique gardée
// (`downloads_music_list`, `downloads_music_collections` : `ipc/downloadsMusic.ts`).

#include "offline/core/args.h"
#include "offline/core/enqueue.h"
#include "offline/core/listing.h"
#include "offline/core/music.h"
#include "offline/glue/channels.h"
#include "offline/glue/commands.h"
#include "offline/glue/runtime.h"

namespace tentacle::offline {
namespace {

std::string userId(const Json& p) { return args::str(p, "userId", 1, 128); }

/// Rattrapage des numéros d'épisode : une fois par session, à la première liste — il lit
/// les `item.json` du disque, donc opère même au démarrage cent pour cent hors ligne.
bool g_backfillDone = false;

}  // namespace

void registerListChannels(bridge::Registry& registry) {
  addCommand(registry, "downloads_state_for_item", [](const Json& p) {
    const std::string user = userId(p);
    return stateForItem(runtime().db(), user, args::str(p, "itemId", 1));
  });
  addCommand(registry, "downloads_set_auto_delete", [](const Json& p) {
    const std::string user = userId(p);
    const int64_t fileId = args::integer(p, "fileId", 0);
    const bool enabled = args::boolean(p, "enabled");
    const int64_t delay = args::integer(p, "delayMinutes");
    setAutoDelete(runtime().db(), user, fileId, enabled, delay, nowMs());
    runtime().notifyChanged();
    return Json(nullptr);
  });
  addCommand(registry, "downloads_list", [](const Json& p) {
    const std::string user = userId(p);
    Runtime& rt = runtime();
    if (!g_backfillDone) {
      g_backfillDone = true;
      try {
        backfillEpisodeNumbers(rt.db(), rt.volume());
      } catch (...) {
        // Racine indisponible : les numéros manqueront, la liste sera là.
      }
    }
    return listForUser(rt.db(), user);
  });
}

void registerMusicListChannels(bridge::Registry& registry) {
  addCommand(registry, "downloads_music_collections", [](const Json& p) {
    const std::string user = userId(p);
    const Json* save = args::field(p, "save");
    const Json* remove = args::field(p, "remove");
    if (save == nullptr || !save->is_array() || save->size() > 500) throw args::Invalid("save : tableau attendu");
    if (remove == nullptr || !remove->is_array() || remove->size() > 500) throw args::Invalid("remove : tableau attendu");
    std::vector<music::Collection> collections;
    for (const Json& c : *save) collections.push_back(music::collectionFromJson(c));
    std::vector<std::string> keys;
    for (const Json& key : *remove) {
      if (!key.is_string() || args::utf16Length(key.get<std::string>()) > 500) throw args::Invalid("remove : clé refusée");
      keys.push_back(key.get<std::string>());
    }
    Database& db = runtime().db();
    const int64_t now = nowMs();
    for (const auto& c : collections) music::saveMusicCollection(db, user, c, now);
    for (const auto& key : keys) music::deleteMusicCollection(db, user, key);
    runtime().notifyChanged();
    return Json(nullptr);
  });
  addCommand(registry, "downloads_music_list", [](const Json& p) {
    const std::string user = userId(p);
    Database& db = runtime().db();
    return Json{{"tracks", music::listMusicForUser(db, user)}, {"collections", music::listMusicCollections(db, user)}};
  });
}

}  // namespace tentacle::offline
