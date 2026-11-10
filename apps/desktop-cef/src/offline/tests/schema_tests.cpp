// Portage de `core/db.test.ts` + le verrou du schéma : chaque palier est comparé, octet pour
// octet, au `schema.ts` d'Electron (la base est partagée : un caractère de différence et
// les titres gardés deviennent invisibles pour l'une des deux coquilles).

#include <regex>

#include "offline/core/rows.h"
#include "offline/core/schema.h"
#include "tests/check.h"

using namespace tentacle::offline;

namespace {

std::vector<std::string> tables(Database& db) {
  std::vector<std::string> names;
  for (const Row& row : db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()) {
    const std::string name = text(row, "name");
    if (name.rfind("sqlite_", 0) != 0) names.push_back(name);
  }
  return names;
}

constexpr const char* kInsertFile =
    "INSERT INTO files (item_id, media_source_id, variant, preset, rel_path, created_at, updated_at)\n"
    "    VALUES (?, ?, ?, ?, ?, 1, 1)";

}  // namespace

TEST(schema_identique_a_electron) {
  const std::string ts = offline_tests::repoFile("packages/offline-core/src/core/schema.ts");
  CHECK(!ts.empty());
  // `const SCHEMA_Vn = \`…\`;` dans l'ordre du tableau `MIGRATIONS`.
  const std::regex block(R"(const SCHEMA_V(\d+) = `([^`]*)`;)");
  std::vector<std::string> fromTs;
  for (auto it = std::sregex_iterator(ts.begin(), ts.end(), block); it != std::sregex_iterator(); ++it) {
    CHECK(std::stoi((*it)[1]) == static_cast<int>(fromTs.size()) + 1);
    fromTs.push_back((*it)[2]);
  }
  CHECK(fromTs.size() == migrations().size());
  for (size_t i = 0; i < fromTs.size() && i < migrations().size(); ++i) {
    if (fromTs[i] != migrations()[i]) std::fprintf(stderr, "  palier v%zu différent\n", i + 1);
    CHECK(fromTs[i] == migrations()[i]);
  }
  CHECK(schemaVersion() == 11);
}

TEST(base_neuve_au_dernier_palier) {
  auto db = openMemoryDatabase();
  CHECK(userVersion(*db) == schemaVersion());
  const std::vector<std::string> expected = {"claims",        "files",          "item_meta",
                                             "music_collections", "music_meta", "playback_state",
                                             "report_queue",  "session_cache", "settings"};
  CHECK(tables(*db) == expected);
}

TEST(base_a_jour_non_retouchee) {
  offline_tests::TempDir dir;
  {
    auto first = openLocalDatabase(dir.path);
    settingSet(*first, "storage_root", "D:/films");
  }
  auto second = openLocalDatabase(dir.path);
  CHECK(userVersion(*second) == schemaVersion());
  CHECK(settingGet(*second, "storage_root") == std::optional<std::string>("D:/films"));
}

TEST(base_ancienne_monte_sans_perte) {
  offline_tests::TempDir dir;
  {
    auto previous = Database::open(dir.path / kDbFileName);
    previous->exec(
        "CREATE TABLE session_cache (jellyfin_user_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL,"
        " policy_json TEXT, cached_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);"
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    previous->prepare("INSERT INTO session_cache VALUES (?, ?, ?, ?, ?)").run("u-1", R"({"Name":"damien"})", Null, 1000, 2000);
    previous->exec("PRAGMA user_version = 1");
  }
  auto migrated = openLocalDatabase(dir.path);
  CHECK(userVersion(*migrated) == schemaVersion());
  const auto row = migrated->prepare("SELECT profile_json FROM session_cache WHERE jellyfin_user_id = ?").get("u-1");
  CHECK(row && text(*row, "profile_json") == R"({"Name":"damien"})");
  migrated->exec(
      "INSERT INTO files (item_id, media_source_id, variant, rel_path, created_at, updated_at,"
      " paused_by_user, audio_stream_index, retry_count, phase)"
      " VALUES ('i1', 'ms1', 'light', 'media/i1/light-ms1-p720.mp4', 1, 1, 1, 3, 2, 'finalize')");
  migrated->exec(
      "INSERT INTO claims (jellyfin_user_id, file_id, created_at, auto_delete_delay_minutes)"
      " VALUES ('u-1', 1, 1, 30)");
}

TEST(contraintes_du_schema) {
  auto db = openMemoryDatabase();
  CHECK_THROWS(db->prepare(kInsertFile).run("i1", "ms1", "bogus", Null, "media/i1/x.mkv"));
  db->prepare(kInsertFile).run("i1", "ms1", "original", Null, "media/i1/original-ms1.mkv");
  CHECK_THROWS(db->prepare(kInsertFile).run("i1", "ms1", "original", Null, "media/i1/original-ms1.mkv"));
  db->prepare(kInsertFile).run("i1", "ms1", "light", "p720", "media/i1/light-ms1-p720.mp4");
  CHECK(integer(*db->prepare("SELECT COUNT(*) AS n FROM files").get(), "n") == 2);
  // Supprimer un fichier emporte ses claims (clés étrangères actives).
  db->prepare("INSERT INTO claims (jellyfin_user_id, file_id, created_at) VALUES (?, ?, 1)").run("u-1", 1);
  db->exec("DELETE FROM files WHERE id = 1");
  CHECK(integer(*db->prepare("SELECT COUNT(*) AS n FROM claims").get(), "n") == 0);
  // La phase n'est pas contrainte.
  db->exec("UPDATE files SET phase = 'futur' WHERE id = 2");
  CHECK(text(*db->prepare("SELECT phase FROM files WHERE id = 2").get(), "phase") == "futur");
}

TEST(ticks_sans_perte_et_reels_gardes) {
  auto db = openMemoryDatabase();
  const int64_t ticks = 360000000000LL;
  db->prepare("INSERT INTO item_meta (item_id, kind, runtime_ticks, created_at, updated_at) VALUES (?, 'movie', ?, 1, 1)")
      .run("i1", ticks);
  CHECK(integer(*db->prepare("SELECT runtime_ticks FROM item_meta").get(), "runtime_ticks") == ticks);
  // Un nombre fractionnaire envoyé par la page reste ce qu'il est (comme sous Node).
  db->prepare("INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, updated_at) VALUES ('u', 'i', ?, 1)")
      .run(numberParam(Json(12.5)));
  CHECK(number(*db->prepare("SELECT position_ticks FROM playback_state").get(), "position_ticks") == Json(12.5));
  CHECK(numberParam(Json(30.0)) == Param{int64_t{30}});
}

TEST(parametres_locaux) {
  auto db = openMemoryDatabase();
  CHECK(!settingGet(*db, "storage_root"));
  settingSet(*db, "storage_root", "D:/films");
  CHECK(settingGet(*db, "storage_root") == std::optional<std::string>("D:/films"));
  settingSet(*db, "storage_root", "E:/films");
  CHECK(settingGet(*db, "storage_root") == std::optional<std::string>("E:/films"));
}

TEST(transaction_annulee_si_leve) {
  auto db = openMemoryDatabase();
  CHECK_THROWS(transaction(*db, [&] {
    settingSet(*db, "a", "1");
    throw std::runtime_error("non");
  }));
  CHECK(!settingGet(*db, "a"));
  transaction(*db, [&] { settingSet(*db, "a", "2"); });
  CHECK(settingGet(*db, "a") == std::optional<std::string>("2"));
}
