// Les commandes du moteur — `ipc/downloadsEngine.ts` (hors listes) et `ipc/downloadsMusic.ts`
// (mise en file, retrait). Les identifiants de connexion restent EN MÉMOIRE du moteur, jamais
// écrits en base.

#include "offline/core/args.h"
#include "offline/core/enqueue.h"
#include "offline/core/music.h"
#include "offline/glue/channels.h"
#include "offline/glue/commands.h"
#include "offline/glue/engine_runtime.h"
#include "offline/glue/runtime.h"

namespace tentacle::offline {
namespace {

std::string userId(const Json& p) { return args::str(p, "userId", 1, 128); }
int64_t fileId(const Json& p) { return args::integer(p, "fileId", 0); }
Creds creds(const Json& p) { return {args::httpUrl(p, "serverUrl"), args::str(p, "token", 1)}; }

const Json& list(const Json& p, const char* key, size_t max) {
  const Json* value = args::field(p, key);
  if (value == nullptr || !value->is_array() || value->size() > max) throw args::Invalid(std::string(key) + " : tableau attendu");
  return *value;
}

/// Un worker qui écrit encore ferait réapparaître le fichier : annulé, et attendu.
Task<void> stopFirst(DownloadEngine& engine, int64_t id) {
  if (!engine.isActive(id)) co_return;
  engine.cancel(id);
  auto waiting = engine.waitNotActive(id, 5000);
  co_await waiting;
}

Task<void> deleteOne(std::string user, int64_t id, bridge::Reply reply) {
  try {
    DownloadEngine& engine = downloadsEngine();
    auto stopping = stopFirst(engine, id);
    co_await stopping;
    Runtime& rt = runtime();
    const DeleteOutcome outcome = deleteClaim(rt.db(), rt.volume(), user, id);
    engine.notifyChanged();
    reply.ok(toJson(outcome));
  } catch (const std::exception& error) {
    failCommand("downloads_delete", reply, error);
  }
}

Task<void> removeMusic(std::string user, std::vector<int64_t> ids, std::optional<std::string> collection, bridge::Reply reply) {
  try {
    DownloadEngine& engine = downloadsEngine();
    Runtime& rt = runtime();
    int64_t removed = 0;
    for (const int64_t id : ids) {
      auto stopping = stopFirst(engine, id);
      co_await stopping;
      if (deleteClaim(rt.db(), rt.volume(), user, id).fileDeleted) ++removed;
    }
    if (collection && !collection->empty()) music::deleteMusicCollection(rt.db(), user, *collection);
    engine.notifyChanged();
    reply.ok(Json{{"removed", removed}});
  } catch (const std::exception& error) {
    failCommand("downloads_music_remove", reply, error);
  }
}

}  // namespace

void registerEngineChannels(bridge::Registry& registry) {
  addCommand(registry, "downloads_engine_start", [](const Json& p) {
    downloadsEngine().start(creds(p));
    return Json(nullptr);
  });
  addCommand(registry, "downloads_enqueue", [](const Json& p) {
    const std::string user = userId(p);
    const Creds c = creds(p);
    std::vector<EnqueueItem> items;
    for (const Json& item : list(p, "items", SIZE_MAX)) items.push_back(enqueueItemFromJson(item));
    DownloadEngine& engine = downloadsEngine();
    engine.setCreds(c);
    Runtime& rt = runtime();
    const Json outcome = enqueueBatch(rt.db(), user, items, freeSpace(rt.volume()), nowMs());
    if (outcome["accepted"] == true) {
      engine.notifyChanged();
      engine.pump();
    }
    return outcome;
  });
  addCommand(registry, "downloads_pause", [](const Json& p) {
    downloadsEngine().pause(fileId(p));
    return Json(nullptr);
  });
  addCommand(registry, "downloads_resume", [](const Json& p) {
    downloadsEngine().resume(fileId(p));
    return Json(nullptr);
  });
  addCommand(registry, "downloads_cancel", [](const Json& p) {
    downloadsEngine().cancel(fileId(p));
    return Json(nullptr);
  });
  addAsyncCommand(registry, "downloads_delete", [](const Json& p, bridge::Reply reply) {
    const std::string user = userId(p);
    spawn(deleteOne(user, fileId(p), reply));
  });
  addCommand(registry, "downloads_music_enqueue", [](const Json& p) {
    const std::string user = userId(p);
    const Creds c = creds(p);
    std::vector<music::KeepItem> items;
    for (const Json& item : list(p, "items", 5000)) items.push_back(music::keepItemFromJson(item));
    std::optional<music::Collection> collection;
    if (const Json* raw = args::field(p, "collection"); raw != nullptr && !raw->is_null()) {
      collection = music::collectionFromJson(*raw);
    }
    DownloadEngine& engine = downloadsEngine();
    engine.setCreds(c);
    Runtime& rt = runtime();
    const Json outcome = music::enqueueMusicBatch(rt.db(), user, items, freeSpace(rt.volume()), nowMs());
    if (outcome["accepted"] == true) {
      if (collection) music::saveMusicCollection(rt.db(), user, *collection, nowMs());
      engine.notifyChanged();
      engine.pump();
    }
    return outcome;
  });
  addAsyncCommand(registry, "downloads_music_remove", [](const Json& p, bridge::Reply reply) {
    const std::string user = userId(p);
    std::vector<int64_t> ids;
    for (const Json& id : list(p, "fileIds", 5000)) ids.push_back(args::integer(Json{{"fileId", id}}, "fileId", 0));
    const auto key = args::optStr(p, "collectionKey", 500);
    spawn(removeMusic(user, ids, key, reply));
  });
}

}  // namespace tentacle::offline
