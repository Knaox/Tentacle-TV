#pragma once
// Les à-côtés d'un titre gardé, tirés du serveur : snapshot Jellyfin (`snapshot.ts`), planches
// trickplay (`trickplay.ts`), segments (`segments.ts`), sous-titres (`subs.ts`), pochette d'un
// titre de musique (`musicLibrary.ts`) et la réparation au démarrage (`heal.ts`).
// Best-effort de bout en bout : rien de tout cela n'empêche jamais un média.

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "offline/core/meta.h"
#include "offline/core/paths.h"
#include "offline/core/sqlite.h"
#include "offline/core/subs.h"
#include "offline/core/task.h"

namespace tentacle::offline {

using Bytes = std::vector<uint8_t>;

/// Récupère une ressource ou rien (TOUS les échecs confondus : réseau, 404, trop gros). Le
/// rappel revient sur le fil hors ligne. Le jeton (`X-Emby-Token`, proxy `/api/jellyfin`) est
/// celui du récupérateur ; le récupérateur PUBLIC n'en porte aucun (https seulement).
using FetchBytes = std::function<void(const std::string& url, int64_t maxBytes, std::function<void(std::optional<Bytes>)> done)>;

/// Plafonds hérités du Rust, par nature de ressource.
inline constexpr int64_t kMaxJsonBytes = 20LL * 1024 * 1024;
inline constexpr int64_t kMaxSubtitleBytes = 15LL * 1024 * 1024;
inline constexpr int64_t kMaxTileBytes = 6LL * 1024 * 1024;

CallbackAwaiter<std::optional<Bytes>> fetch(const FetchBytes& fetchBytes, const std::string& url, int64_t maxBytes);

/// Le snapshot complet sous `meta/<itemId>/`, puis `images_state` et la version de contenu.
Task<void> snapshot(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, MetaSpec spec, int64_t nowMs);

/// Planches trickplay manquantes ; rend le nombre disponible. `itemJson` : les octets du DTO
/// déjà lu (analysés en gardant l'ordre des clés, comme `Object.keys`).
Task<int64_t> fetchTrickplay(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId,
                             std::string mediaSourceId, Bytes itemJson, int64_t nowMs);
bool trickplayExists(const Volume& volume, const std::string& itemId);
/// Constaté sans trickplay, et depuis moins d'un mois ?
bool trickplayNoneRecently(const Volume& volume, const std::string& itemId, int64_t nowMs);
/// Le choix de largeur (la plus proche de 320, ordre des clés de JavaScript) — testé seul.
std::optional<nlohmann::ordered_json> pickTrickplayWidth(const nlohmann::ordered_json& manifest,
                                                         const std::string& mediaSourceId);

/// `segments.json` au contrat résolu v1 ; vrai si plausible ET écrit.
Task<bool> fetchSegments(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId);
bool segmentsNeedRefresh(const Volume& volume, const std::string& itemId);

/// Sous-titres manquants ; rend le nombre disponible. `onSkipped(spec, raison)` : la seule trace
/// d'une piste perdue (`format`, `path`, `fetch`, `write`).
Task<int64_t> fetchSubtitles(FetchBytes fetchBytes, std::string serverUrl, Volume volume, std::string itemId,
                             std::string mediaSourceId, std::vector<SubtitleSpec> specs,
                             std::function<void(const SubtitleSpec&, const std::string&)> onSkipped = {});

/// La pochette d'un titre, posée à côté de son média si elle manque ; un chemin du serveur
/// part avec le jeton, une adresse https d'ailleurs SANS (`fetchPublic`), ou pas du tout.
Task<bool> fetchMusicCover(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, std::string itemId,
                           FetchBytes fetchPublic);

/// Réparation des titres DÉJÀ complets ; rend le nombre d'items touchés. Ne lève jamais.
Task<int64_t> heal(FetchBytes fetchBytes, Database& db, std::string serverUrl, Volume volume, int64_t nowMs,
                   FetchBytes fetchPublic);

}  // namespace tentacle::offline
