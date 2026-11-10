// Session hors ligne et photo de profil — `ipc/session.ts` d'Electron.
//
// Déclarer `session_cache_get` fait passer `supportsOfflineSession()` à vrai côté page : le
// mode hors ligne, les droits en cache et l'avatar hors ligne réapparaissent d'eux-mêmes.

#include "offline/glue/channels.h"

#include <chrono>

#include "offline/core/args.h"
#include "offline/core/session_cache.h"
#include "offline/glue/commands.h"
#include "offline/glue/runtime.h"

namespace tentacle::offline {

int64_t nowMs() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

namespace {

/// `USER_ID` : un identifiant Jellyfin, 1 à 128 caractères.
std::string userId(const Json& payload) { return args::str(payload, "userId", 1, 128); }

}  // namespace

void registerSessionChannels(bridge::Registry& registry) {
  addCommand(registry, "session_cache_get", [](const Json& p) {
    return session::get(runtime().db(), userId(p), nowMs());
  });
  addCommand(registry, "session_cache_set", [](const Json& p) {
    const std::string user = userId(p);
    const std::string profile = args::str(p, "profileJson");
    // La page envoie `policyJson ?? null` ; `null` CONSERVE la policy en cache.
    const auto policy = args::optStr(p, "policyJson");
    session::set(runtime().db(), user, profile, policy, nowMs());
    return Json(nullptr);
  });
  addCommand(registry, "session_cache_clear", [](const Json& p) {
    session::clear(runtime().db(), userId(p));
    return Json(nullptr);
  });
  addCommand(registry, "avatar_cache_put", [](const Json& p) {
    const std::string user = userId(p);
    // Première barrière, avant tout décodage : le plafond réel est en octets décodés.
    const std::string base64 = args::str(p, "base64Jpeg", 0, 1024 * 1024);
    avatar::put(runtime().avatarsDir(), user, base64);
    return Json(nullptr);
  });
  addCommand(registry, "avatar_cache_get", [](const Json& p) {
    const auto photo = avatar::get(runtime().avatarsDir(), userId(p));
    return photo ? Json(*photo) : Json(nullptr);
  });
}

}  // namespace tentacle::offline
