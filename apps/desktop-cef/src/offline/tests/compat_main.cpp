// Le scénario de compatibilité, côté CEF : le cœur C++ écrit une base, ou relit celle que le
// cœur d'Electron a écrite, et rend ce que la page en verrait — pendant exact de
// `bench/offline/fixture.ts` (même scénario : `bench/offline/scenario.json`).
//   tentacle_offline_compat write <dossier>
//   tentacle_offline_compat read <dossier> <sortie.json>

#include <cstdio>
#include <fstream>
#include <sstream>

#include "offline/core/enqueue.h"
#include "offline/core/listing.h"
#include "offline/core/meta.h"
#include "offline/core/music.h"
#include "offline/core/playback.h"
#include "offline/core/queue.h"
#include "offline/core/rows.h"
#include "offline/core/schema.h"
#include "offline/core/session_cache.h"
#include "offline/core/utf8_path.h"

using namespace tentacle::offline;
namespace fs = std::filesystem;

namespace {

Json readScenario() {
  std::ifstream in(fs::path(TENTACLE_REPO_ROOT) / "apps/desktop-cef/bench/offline/scenario.json", std::ios::binary);
  std::stringstream buffer;
  buffer << in.rdbuf();
  return Json::parse(buffer.str());
}

Json valueJson(const Value& v) {
  if (const auto* i = std::get_if<int64_t>(&v)) return *i;
  if (const auto* d = std::get_if<double>(&v)) return *d;
  if (const auto* s = std::get_if<std::string>(&v)) return *s;
  return nullptr;
}

Json rowsJson(const std::vector<Row>& rows) {
  Json list = Json::array();
  for (const Row& row : rows) {
    Json object = Json::object();
    for (const auto& [name, value] : row.columns) object[name] = valueJson(value);
    list.push_back(object);
  }
  return list;
}

void write(Database& db, const Volume& volume, const fs::path& userData, const Json& s) {
  session::set(db, s["U1"], s["PROFILE1"], s["POLICY1"].get<std::string>(), 1000);
  session::set(db, s["U2"], s["PROFILE2"], std::nullopt, 1000);
  avatar::put(userData / "avatars", s["U1"], s["AVATAR"]);
  std::vector<EnqueueItem> items;
  for (const Json& item : s["ITEMS"]) items.push_back(enqueueItemFromJson(item));
  enqueueBatch(db, s["U1"], items, 1000000000000000LL, 2000);
  enqueueBatch(db, s["U2"], {items[0]}, 1000000000000000LL, 2100);
  std::vector<music::KeepItem> tracks;
  for (const Json& t : s["TRACKS"]) tracks.push_back(music::keepItemFromJson(t));
  music::enqueueMusicBatch(db, s["U1"], tracks, 1000000000000000LL, 2200);
  music::saveMusicCollection(db, s["U1"], music::collectionFromJson(s["COLLECTION"]), 2200);
  for (const Json& f : s["FILES"]) {
    const fs::path target = safeJoin(volume, f[0]);
    fs::create_directories(target.parent_path());
    std::ofstream(target, std::ios::binary) << f[1].get<std::string>();
  }
  for (const Json& c : s["COMPLETE"]) {
    setBytesDone(db, c[0], c[1], 2500);
    setStatus(db, c[0], "complete", std::nullopt, 2500);
  }
  for (const Json& p : s["PLAYBACK"]) {
    setPlaybackState(db, s["U1"], p[0], p[1], p[2], true, p[3]);
    scheduleOnPlayed(db, s["U1"], p[0], p[3]);
  }
  setAutoDelete(db, s["U1"], 1, true, 30, 4000);
  setStatus(db, s["PAUSED_FILE"], "paused", std::nullopt, 4100);
  setPausedByUser(db, s["PAUSED_FILE"], true);
  settingSet(db, "background_transfers", "0");
}

Json read(Database& db, const Volume& volume, const fs::path& userData, const Json& s) {
  Json tables = Json::object();
  for (const Row& row : db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()) {
    const std::string name = text(row, "name");
    tables[name] = rowsJson(db.prepare("SELECT * FROM \"" + name + "\" ORDER BY rowid").all());
  }
  const fs::path avatars = userData / "avatars";
  const std::string u1 = s["U1"], u2 = s["U2"];
  Json kept = Json::array();
  for (const Json& t : s["TRACKS"]) kept.push_back(opt(music::keptAudioPath(db, volume, u1, t["trackKey"], 6000)));
  return {
      {"userVersion", userVersion(db)},
      {"schema", rowsJson(db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY name").all())},
      {"tables", tables},
      {"session", {session::get(db, u1, 6000), session::get(db, u2, 6000), session::get(db, "inconnu", 6000)}},
      {"avatar", {opt(avatar::get(avatars, u1)), opt(avatar::get(avatars, u2))}},
      {"list", {{"u1", listForUser(db, u1)}, {"u2", listForUser(db, u2)}}},
      {"state", {stateForItem(db, u1, s["F1"]), stateForItem(db, u1, s["E2"]), stateForItem(db, u2, s["E1"])}},
      {"reports", pendingReports(db, u1)},
      {"music", {{"tracks", music::listMusicForUser(db, u1)}, {"collections", music::listMusicCollections(db, u1)}}},
      {"kept", kept},
      {"diskUsage", diskUsage(db)},
      {"background", opt(settingGet(db, "background_transfers"))},
      {"localSource",
       {localSource(db, volume, u1, s["F1"], 6000), localSource(db, volume, u1, s["E1"], 6000),
        localSource(db, volume, u2, s["F1"], 6000)}},
  };
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 3) {
    std::fprintf(stderr, "usage : %s write|read <dossier> [sortie.json]\n", argv[0]);
    return 2;
  }
  const std::string mode = argv[1];
  const fs::path userData = utf8ToPath(argv[2]);
  try {
    const Json scenario = readScenario();
    auto db = openLocalDatabase(userData);
    const Volume volume = resolveRoot(*db, userData);
    if (mode == "write") {
      write(*db, volume, userData, scenario);
      return 0;
    }
    const fs::path out = argc > 3 ? utf8ToPath(argv[3]) : userData / "cef.json";
    std::ofstream(out, std::ios::binary) << read(*db, volume, userData, scenario).dump(1);
    return 0;
  } catch (const std::exception& e) {
    std::fprintf(stderr, "compat : %s\n", e.what());
    return 1;
  }
}
