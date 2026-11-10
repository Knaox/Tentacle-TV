#pragma once
// Le snapshot catalogique d'un item : `item_meta` et `meta/<itemId>/` — `core/meta.ts`,
// plus les lectures prudentes d'un DTO Jellyfin (`core/json.ts`).

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/paths.h"
#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

/// Version du CONTENU du snapshot (6 : bibliothèque nommée). La réparation rephotographie
/// tout ce qui est en dessous.
inline constexpr int kCurrentMetaVersion = 6;

struct MetaSpec {
  std::string itemId;
  std::string kind;  // movie | episode
  std::optional<std::string> seriesId, seasonId, libraryId;
  std::optional<int64_t> runtimeTicks;
  std::optional<std::string> title, seriesName;
  std::optional<int64_t> indexNumber, parentIndexNumber;
};

/// `COALESCE` sur titres et numéros : une remise en file qui ne les porte pas n'efface rien.
void upsertItemMeta(Database& db, const MetaSpec& spec, int64_t nowMs);
std::optional<MetaSpec> getSpec(Database& db, const std::string& itemId);
/// Enregistre des octets sous la racine, dossiers créés au besoin ; faux sur tout échec.
bool saveBytes(const Volume& volume, const std::string& rel, const std::vector<uint8_t>& bytes);
bool snapshotExists(const Volume& volume, const std::string& itemId);
bool seriesPrimaryExists(const Volume& volume, const std::string& itemId);
int64_t metaVersion(Database& db, const std::string& itemId);
void markSnapshotDone(Database& db, const std::string& itemId, const std::string& imagesState, int64_t nowMs);

struct LibraryRef {
  std::string id;
  std::optional<std::string> name;
  std::optional<std::string> collectionType;
};
void setLibrary(Database& db, const std::string& itemId, const LibraryRef& library);

// --- Lecture prudente d'un DTO (`json.ts`) : `null` plutôt que lever ----------------------

/// Les octets UTF-8 analysés, ou `null` si ce n'est pas du JSON.
Json parseJson(const std::vector<uint8_t>& bytes);
Json parseJsonText(const std::string& text);
/// Le champ d'un OBJET (un tableau n'en est pas un), `null` sinon.
const Json* jsonField(const Json& value, const char* key);
/// L'entier (un flottant est tronqué), ou rien.
std::optional<int64_t> asInteger(const Json* value);
/// La chaîne NON VIDE, ou rien.
std::optional<std::string> asString(const Json* value);

}  // namespace tentacle::offline
