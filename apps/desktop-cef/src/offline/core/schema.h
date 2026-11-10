#pragma once
// Le schéma de `tentacle-local.db` et son ouverture — `schema.ts` et `db.ts` d'Electron.
//
// Les migrations sont pilotées par `PRAGMA user_version` : sur une base d'Electron déjà en
// v11, rien ne s'exécute. Une base PLUS RÉCENTE (un Electron d'après) est laissée telle
// quelle, comme le fait Electron — on ne descend jamais une version.

#include <filesystem>
#include <memory>
#include <optional>
#include <string>
#include <type_traits>
#include <vector>

#include "offline/core/sqlite.h"

namespace tentacle::offline {

/// Les paliers, figés. L'index vaut la version.
const std::vector<std::string>& migrations();
/// Version de schéma que ce code sait produire et lire (11).
int schemaVersion();

/// Nom du fichier, dans le dossier de données : le MÊME qu'Electron.
inline constexpr const char* kDbFileName = "tentacle-local.db";

/// Pose les PRAGMA (WAL, clés étrangères, attente de verrou) et applique les migrations.
void prepareDatabase(Database& db);
/// `<dossier>/tentacle-local.db`, dossier créé au besoin, ouvert et préparé.
std::unique_ptr<Database> openLocalDatabase(const std::filesystem::path& userDataDir);
/// Base en mémoire, même schéma (tests).
std::unique_ptr<Database> openMemoryDatabase();

int userVersion(Database& db);

/// Exécute `body` dans une transaction ; tout est annulé s'il lève. Ne s'imbrique pas.
template <class F>
auto transaction(Database& db, F&& body) -> decltype(body()) {
  db.exec("BEGIN");
  try {
    if constexpr (std::is_void_v<decltype(body())>) {
      body();
      db.exec("COMMIT");
    } else {
      auto result = body();
      db.exec("COMMIT");
      return result;
    }
  } catch (...) {
    try {
      db.exec("ROLLBACK");
    } catch (...) {
      // SQLite a déjà annulé de lui-même (certaines erreurs le font) : l'erreur d'origine compte.
    }
    throw;
  }
}

/// Paramètres locaux (racine de stockage, réglages de l'appareil).
std::optional<std::string> settingGet(Database& db, const std::string& key);
void settingSet(Database& db, const std::string& key, const std::string& value);

}  // namespace tentacle::offline
