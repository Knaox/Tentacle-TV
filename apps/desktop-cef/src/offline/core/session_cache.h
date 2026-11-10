#pragma once
// Cache de session hors ligne et photo de profil — `core/session.ts` et
// `downloads/avatar.ts` d'Electron.
//
// Profil et droits PAR utilisateur, SANS aucun secret ; TTL de 30 jours GLISSANTS (chaque
// écriture repousse l'échéance). À échéance l'entrée est gardée mais dite `expired`.

#include <filesystem>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "offline/core/sqlite.h"

namespace tentacle::offline::session {

using Json = nlohmann::json;

inline constexpr int64_t kSessionTtlMs = 30LL * 24 * 60 * 60 * 1000;

/// `{profileJson, policyJson, cachedAt, expiresAt, expired}` ou `null`.
Json get(Database& db, const std::string& userId, int64_t nowMs);
/// `policyJson` absent CONSERVE la policy en cache.
void set(Database& db, const std::string& userId, const std::string& profileJson,
         const std::optional<std::string>& policyJson, int64_t nowMs);
void clear(Database& db, const std::string& userId);

}  // namespace tentacle::offline::session

namespace tentacle::offline::avatar {

/// Plafond en octets décodés : l'envoi redimensionne déjà à 512 px.
inline constexpr size_t kMaxBytes = 512 * 1024;

/// Nom de fichier sûr : les seuls caractères alphanumériques ASCII ; vide → lève.
std::string safeStem(const std::string& userId);
/// `<dossier>/<stem>.jpg`, dossier créé au besoin.
std::filesystem::path avatarPath(const std::filesystem::path& avatarsDir, const std::string& userId);
/// Enregistre la photo (base64 canonique), par fichier temporaire puis renommage. Lève.
void put(const std::filesystem::path& avatarsDir, const std::string& userId, const std::string& base64Jpeg);
/// La photo en base64, ou rien (premier lancement : le cas nominal).
std::optional<std::string> get(const std::filesystem::path& avatarsDir, const std::string& userId);

}  // namespace tentacle::offline::avatar
