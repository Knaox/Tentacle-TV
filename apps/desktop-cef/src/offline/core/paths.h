#pragma once
// Racine de stockage, arborescence, espace disque et chemins sûrs — `core/paths.ts`.
//
// La racine par défaut est `<dossier de données>/downloads`, configurable par
// `settings.storage_root` ; le changement est REFUSÉ tant que des titres existent. Tous les
// chemins en base sont RELATIFS à la racine et confinés à `media/` ou `meta/` : `safeJoin`
// est la seule chose qui empêche une traversée (la base a été remplie à partir
// d'identifiants venus d'un serveur).

#include <cstdint>
#include <filesystem>
#include <string>

#include "offline/core/sqlite.h"

namespace tentacle::offline {

inline constexpr const char* kStorageRootKey = "storage_root";
/// Jamais moins de 2 Gio laissés libres sur le disque.
inline constexpr int64_t kCapacityMarginBytes = 2LL * 1024 * 1024 * 1024;

/// Une racine (texte UTF-8 tel qu'enregistré : Electron le relit tel quel).
struct Volume {
  std::string root;
  std::filesystem::path rootPath() const;
};

std::string defaultRoot(const std::filesystem::path& userDataDir);
/// Crée `media/` et `meta/` sous la racine.
void ensureLayout(const Volume& volume);
/// Volume effectif : cache mémoire → paramètre enregistré → défaut.
Volume resolveRoot(Database& db, const std::filesystem::path& userDataDir);
/// Oublie le volume mémorisé (tests, `setRoot`).
void forgetRoot();
/// Change la racine. Lève `root-not-empty` ou `root-not-writable: <cause>` (codes STABLES,
/// lus tels quels par l'interface).
std::string setRoot(Database& db, const std::string& newRoot);

int64_t freeSpace(const Volume& volume);
/// STRICTEMENT supérieur : demander exactement l'espace libre moins la marge ne laisse rien.
inline bool hasCapacity(int64_t needed, int64_t free, int64_t margin = kCapacityMarginBytes) {
  return free > needed + margin;
}

/// Joint un chemin RELATIF sous la racine ; lève `invalid-path` sur toute traversée.
std::filesystem::path safeJoin(const Volume& volume, const std::string& rel);

/// Supprime le fichier final ET son `.part` ; absent n'est pas une erreur.
void removeMediaFile(const Volume& volume, const std::string& rel);
void removeItemMetaDir(const Volume& volume, const std::string& itemId);
/// Le dossier média entier (side-cars de sous-titres compris).
void removeItemMediaDir(const Volume& volume, const std::string& itemId);
bool mediaFileExists(const Volume& volume, const std::string& rel);

}  // namespace tentacle::offline
