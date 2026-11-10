#pragma once
// Le contexte du fil hors ligne : dossier de données, base locale, sortie des évènements.
//
// Tout ici n'est touché QUE depuis le fil hors ligne (`offline_thread.h`), sauf `emit`
// (sûr depuis n'importe quel fil : il repasse par la plomberie du socle).

#include <filesystem>
#include <functional>
#include <memory>
#include <string>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

struct Runtime {
  /// Le dossier de données d'Electron (`dataPaths.ts`) : base, avatars, racine par défaut.
  std::filesystem::path userData;
  /// Vers la page (`downloads://progress`, `downloads://changed`), charge NUE.
  std::function<void(const std::string& event, const Json& payload)> emit;

  /// La connexion, ouverte au PREMIER besoin (`localDb.ts`) : un utilisateur qui n'a jamais
  /// rien gardé ne paie rien.
  Database& db();
  /// Refermée à l'extinction : le WAL se replie dans le fichier.
  void closeDb();

  std::filesystem::path avatarsDir() const { return userData / "avatars"; }
  /// La racine de stockage effective (relue en base une fois, puis gardée : `paths.ts`).
  Volume volume();
  /// « Quelque chose a changé » : la page relit ses listes.
  void notifyChanged() const;

 private:
  std::unique_ptr<Database> database_;
};

/// Le contexte (fil hors ligne seulement).
Runtime& runtime();

}  // namespace tentacle::offline
