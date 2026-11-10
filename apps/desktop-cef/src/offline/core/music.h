#pragma once
// La musique gardée (Octave) dans le MÊME moteur que les films — `core/musicKeep.ts` et
// `core/musicLibrary.ts` (hors réseau ; la pochette se récupère avec le transfert).
//
// Un titre gardé est un fichier comme un autre (`files`, `claims`, même file, mêmes
// relances) dont la fiche vit dans `music_meta` et dont le média se tire d'un chemin du
// serveur Tentacle (`files.source_path`).

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"

namespace tentacle::offline::music {

using Json = nlohmann::json;

struct KeepItem {
  std::string trackKey;  // `jf:<id>` ou `ext:<extension>:<identifiant>`
  std::string origin;    // library | external
  std::string sourcePath;
  std::string variant;
  std::optional<std::string> preset;
  std::string containerExt;
  std::optional<int64_t> expectedSize, estimatedSize;
  std::string title;
  std::optional<std::string> artist, album, albumKey;
  std::optional<int64_t> discNumber, trackNumber, durationMs;
  std::optional<std::string> artworkPath;
  std::string trackJson;
};

struct Collection {
  std::string key, kind, title;
  std::optional<std::string> subtitle, coverItemId;
  std::vector<std::string> trackKeys;
};

/// Les formes de `ipc/downloadsMusic.ts` (zod) ; lèvent `args::Invalid`.
KeepItem keepItemFromJson(const Json& item);
Collection collectionFromJson(const Json& collection);

/// Empreinte de 128 bits (quatre FNV-1a sur les UNITÉS UTF-16) : elle NOMME des fichiers.
std::string digest(const std::string& utf8);
/// `jf:` → l'identifiant Jellyfin (sans tirets, minuscule) ; `ext:` → `ext-<empreinte>`.
std::optional<std::string> musicItemId(const std::string& trackKey);
bool isPublicArtUrl(const std::string& url);
bool isServerPath(const std::string& path);
/// Lève `empty-batch` ou `invalid-item`.
void validateMusicBatch(const std::vector<KeepItem>& items);
std::string musicRelPath(const std::string& itemId, const KeepItem& item);

/// `{accepted, neededBytes, freeBytes, fileIds}` ; refus d'espace GLOBAL.
Json enqueueMusicBatch(Database& db, const std::string& userId, std::vector<KeepItem> batch, int64_t freeBytes,
                       int64_t nowMs, int64_t margin = kCapacityMarginBytes);

/// Les titres gardés par ce compte, rangés par album puis par place.
Json listMusicForUser(Database& db, const std::string& userId);
std::optional<std::string> musicItemOfKey(Database& db, const std::string& trackKey);
bool isMusicItem(Database& db, const std::string& itemId);
void saveMusicCollection(Database& db, const std::string& userId, const Collection& collection, int64_t nowMs);
void deleteMusicCollection(Database& db, const std::string& userId, const std::string& key);
Json listMusicCollections(Database& db, const std::string& userId);

/// La copie gardée d'un titre (chemin ABSOLU), ou rien : le serveur, comme si de rien
/// (`ipc/audioKept.ts`). Jamais une exception.
std::optional<std::string> keptAudioPath(Database& db, const Volume& volume, const std::string& userId,
                                         const std::string& trackKey, int64_t nowMs);

}  // namespace tentacle::offline::music
