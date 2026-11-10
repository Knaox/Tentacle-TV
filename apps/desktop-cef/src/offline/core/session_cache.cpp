#include "offline/core/session_cache.h"

#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>

#include "offline/core/base64.h"
#include "offline/core/rows.h"

namespace tentacle::offline::session {

Json get(Database& db, const std::string& userId, int64_t nowMs) {
  const auto row = db.prepare(
                         "SELECT profile_json, policy_json, cached_at, expires_at\n"
                         "       FROM session_cache WHERE jellyfin_user_id = ?")
                       .get(userId);
  if (!row) return nullptr;
  const int64_t expiresAt = integer(*row, "expires_at");
  const auto policy = textOrNull(*row, "policy_json");
  return {
      {"profileJson", text(*row, "profile_json")},
      {"policyJson", policy ? Json(*policy) : Json(nullptr)},
      {"cachedAt", number(*row, "cached_at")},
      {"expiresAt", number(*row, "expires_at")},
      {"expired", nowMs > expiresAt},
  };
}

void set(Database& db, const std::string& userId, const std::string& profileJson,
         const std::optional<std::string>& policyJson, int64_t nowMs) {
  db.prepare(
        "INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)\n"
        "     VALUES (?, ?, ?, ?, ?)\n"
        "     ON CONFLICT(jellyfin_user_id) DO UPDATE SET\n"
        "       profile_json = excluded.profile_json,\n"
        "       policy_json  = COALESCE(excluded.policy_json, session_cache.policy_json),\n"
        "       cached_at    = excluded.cached_at,\n"
        "       expires_at   = excluded.expires_at")
      .run(userId, profileJson, policyJson, nowMs, nowMs + kSessionTtlMs);
}

void clear(Database& db, const std::string& userId) {
  db.prepare("DELETE FROM session_cache WHERE jellyfin_user_id = ?").run(userId);
}

}  // namespace tentacle::offline::session

namespace tentacle::offline::avatar {
namespace fs = std::filesystem;

std::string safeStem(const std::string& userId) {
  // Les identifiants sont des UUID sans tiret, mais rien ne l'impose côté serveur : on n'écrit
  // que des alphanumériques, ce qui interdit `..`, `/`, `\` et les noms réservés de Windows.
  // (Electron filtre par point de code `[A-Za-z0-9]` : un octet UTF-8 n'en est jamais un.)
  std::string stem;
  for (const char c : userId) {
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) stem.push_back(c);
  }
  if (stem.empty()) throw std::runtime_error("identifiant utilisateur invalide");
  return stem;
}

fs::path avatarPath(const fs::path& avatarsDir, const std::string& userId) {
  fs::create_directories(avatarsDir);
  return avatarsDir / (safeStem(userId) + ".jpg");
}

void put(const fs::path& avatarsDir, const std::string& userId, const std::string& base64Jpeg) {
  // Un décodeur tolérant ferait d'une entrée abîmée un JPEG tronqué, donc une photo cassée
  // pour toutes les sessions suivantes : base64 CANONIQUE seulement.
  const auto bytes = base64::decodeStrict(base64Jpeg);
  if (!bytes) throw std::runtime_error("avatar : base64 invalide");
  if (bytes->empty() || bytes->size() > kMaxBytes) {
    throw std::runtime_error("taille d'avatar hors bornes : " + std::to_string(bytes->size()) + " octets");
  }
  const fs::path target = avatarPath(avatarsDir, userId);
  // Fichier temporaire puis renommage : une coupure en cours d'écriture laisserait sinon un
  // JPEG tronqué.
  fs::path tmp = target;
  tmp += ".part";
  {
    std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
    if (!out) throw std::runtime_error("avatar : écriture impossible");
    out.write(reinterpret_cast<const char*>(bytes->data()), static_cast<std::streamsize>(bytes->size()));
    if (!out) throw std::runtime_error("avatar : écriture impossible");
  }
  fs::rename(tmp, target);
}

std::optional<std::string> get(const fs::path& avatarsDir, const std::string& userId) {
  try {
    std::ifstream in(avatarPath(avatarsDir, userId), std::ios::binary);
    if (!in) return std::nullopt;
    const std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    if (bytes.empty()) return std::nullopt;
    return base64::encode(bytes);
  } catch (...) {
    // Absence de fichier = cas nominal au premier lancement, pas une erreur.
    return std::nullopt;
  }
}

}  // namespace tentacle::offline::avatar
