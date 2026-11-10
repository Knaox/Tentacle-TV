// Ouverture et migration de la base locale — `db.ts` et `node/nodeDatabase.ts` d'Electron.
//
// Le même fichier que l'app Electron : ce n'est PAS une base neuve, c'est celle que
// l'utilisateur a déjà, avec ses titres gardés et sa session. WAL et `busy_timeout` restent
// posés : le fichier peut être ouvert par une autre coquille sur une machine de
// développement (jamais en même temps en usage normal : garde du lanceur).

#include <string>

#include "offline/core/rows.h"
#include "offline/core/schema.h"

namespace tentacle::offline {
namespace {

void configure(Database& db) {
  // WAL : lectures et écriture concurrentes sans blocage mutuel.
  db.exec("PRAGMA journal_mode = WAL");
  // Le `ON DELETE CASCADE` de `claims` en dépend.
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
}

void apply(Database& db, const std::string& sql, int target) {
  // Chaque palier est atomique : une migration à moitié appliquée laisserait une base dont
  // la version ment sur le contenu.
  db.exec("BEGIN;\n" + sql + "\nCOMMIT;");
  // `target` est un entier produit par la boucle, jamais une donnée venue de l'extérieur.
  db.exec("PRAGMA user_version = " + std::to_string(target));
}

void migrate(Database& db) {
  const auto& list = migrations();
  for (int index = userVersion(db); index < static_cast<int>(list.size()); ++index) {
    apply(db, list[static_cast<size_t>(index)], index + 1);
  }
}

}  // namespace

void prepareDatabase(Database& db) {
  configure(db);
  migrate(db);
}

std::unique_ptr<Database> openLocalDatabase(const std::filesystem::path& userDataDir) {
  std::filesystem::create_directories(userDataDir);
  auto db = Database::open(userDataDir / kDbFileName);
  prepareDatabase(*db);
  return db;
}

std::unique_ptr<Database> openMemoryDatabase() {
  auto db = Database::openInMemory();
  prepareDatabase(*db);
  return db;
}

int userVersion(Database& db) {
  const auto row = db.prepare("PRAGMA user_version").get();
  return row ? static_cast<int>(integer(*row, "user_version")) : 0;
}

std::optional<std::string> settingGet(Database& db, const std::string& key) {
  const auto row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? textOrNull(*row, "value") : std::nullopt;
}

void settingSet(Database& db, const std::string& key, const std::string& value) {
  db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?)\n"
        "     ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value);
}

}  // namespace tentacle::offline
