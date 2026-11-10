#pragma once
// Les requêtes DÉLÉGUÉES à l'appareil (capacité `plugins.clientFetch`) — la règle, portage de
// `apps/desktop-electron/src/main/clientFetch/pluginClientFetch.ts` (miroir du contrat partagé)
// et `safeLookup.ts`. Une extension DÉCRIT une requête HTTP ; le bureau l'exécute depuis la
// connexion de l'utilisateur. Le cœur ne devient pas un proxy ouvert : https seul, hôtes
// DÉCLARÉS (noms exacts), ni identifiants ni port, en-têtes de connexion et d'authentification
// interdits, corps et délai bornés ; jamais une adresse privée.

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "net/web_url.h"

namespace tentacle::net::cf {

using Json = nlohmann::json;

namespace limits {
inline constexpr size_t maxHosts = 16;
inline constexpr size_t maxHeaders = 20;
inline constexpr size_t maxHeaderBytes = 8 * 1024;
inline constexpr size_t maxRequestBody = 64 * 1024;
inline constexpr int64_t defaultTimeoutMs = 5'000;
inline constexpr int64_t maxTimeoutMs = 8'000;
inline constexpr int64_t defaultMaxBytes = 1024 * 1024;
inline constexpr int64_t maxResponseBytes = 2 * 1024 * 1024;
inline constexpr int maxRedirects = 3;
inline constexpr int maxParallel = 4;
inline constexpr int perMinute = 30;
inline constexpr int perHour = 300;
}  // namespace limits

/// `plugin.json` → `runtime.clientFetch`, validé.
struct Manifest {
  std::vector<std::string> hosts;       // hôtes joints (noms exacts)
  std::vector<std::string> mediaHosts;  // flux lus EN DIRECT ; un joker « *. » en tête permis
  bool operator==(const Manifest&) const = default;
};

/// Un nom d'hôte PUBLIC et déclarable : au moins deux labels, ni IP, ni `localhost`, ni
/// domaine local.
bool isDeclarableHost(const std::string& host);
/// `runtime.clientFetch` validé ; nullopt s'il est absent ou mal formé.
std::optional<Manifest> readManifest(const Json& raw);
/// Égalité exacte ; `*.d` vaut tout sous-domaine de `d` (jamais `d` lui-même).
bool hostAllowed(const std::string& host, const std::vector<std::string>& patterns);
/// Une adresse https sans identifiants ni port, d'un hôte de `patterns` ; nullopt sinon.
std::optional<WebUrl> allowedUrl(const std::string& raw, const std::vector<std::string>& patterns);
/// La requête est-elle permise par ce manifeste ? nullopt : oui ; sinon le motif (journal).
std::optional<std::string> checkRequest(const Json& request, const Manifest& manifest);
/// L'adresse est-elle hors d'Internet public (réseau local, boucle, lien local, CGNAT,
/// multidiffusion, documentation) ? Une chaîne qui n'est pas une IP : oui.
bool isPrivateAddress(const std::string& ip);
/// `new URL(ref, base).href` pour une base http(s) : nullopt si le résultat n'est pas http(s).
std::optional<WebUrl> resolveUrl(const WebUrl& base, const std::string& ref);

}  // namespace tentacle::net::cf
