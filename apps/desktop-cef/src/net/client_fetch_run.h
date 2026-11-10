#pragma once
// Les requêtes déléguées — le plafond par extension (`clientFetchQuota.ts`), l'exécution par
// sauts revalidés (`clientFetchRunner.ts`), le manifeste lu par l'app sur le serveur
// (`pluginManifests.ts`) et le tout (`delegatedRun.ts`). Pur : réseau, horloge et saut injectés.

#include <cstdint>
#include <functional>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "net/cef_fetch.h"
#include "net/client_fetch_policy.h"

namespace tentacle::net::cf {

/// 4 à la fois, 30 par minute, 300 par heure, par extension. `take` rend la fonction qui rend
/// la place (une fois), ou nullptr : refusée.
class Quota {
 public:
  explicit Quota(std::function<int64_t()> now = nullptr) : now_(std::move(now)) {}
  std::function<void()> take(const std::string& pluginId);

 private:
  std::function<int64_t()> now_;
  std::map<std::string, std::vector<int64_t>> starts_;
  std::shared_ptr<std::map<std::string, int>> running_ = std::make_shared<std::map<std::string, int>>();
};

struct HopRequest {
  WebUrl url;
  std::string method;
  HeaderList headers;
  std::optional<std::string> body;
  int64_t deadline = 0;  // horloge de `now`
  int64_t maxBytes = 0;
};

struct HopResult {
  enum Kind { kResponse, kRedirect, kFailed } kind = kFailed;
  int status = 0;
  std::optional<std::string> contentType;
  std::string body;
  std::string location;
  std::string reason;  // kFailed : offline | refused | timeout | budget | network | tooLarge
};

using Hop = std::function<void(HopRequest, std::function<void(HopResult)>)>;

/// `ClientFetchOutcome` : `{ok: true, response: {status, url, headers, body}}` ou `{ok: false, reason}`.
struct Outcome {
  bool ok = false;
  int status = 0;
  std::string url;
  std::optional<std::string> contentType;
  std::string body;
  std::string reason;
  Json toJson() const;
  static Outcome refused(std::string reason) { return Outcome{false, 0, {}, {}, {}, std::move(reason)}; }
};

/// La requête jugée contre `manifest` (AVANT tout envoi), puis exécutée, redirections suivies À LA
/// MAIN (3 au plus, chacune revalidée ; 303 et 301/302 après un POST repartent en GET sans corps).
void runClientFetch(const Json& request, const Manifest& manifest, Hop hop, std::function<int64_t()> now,
                    std::function<void(Outcome)> done);

struct ServerSession {
  std::string serverOrigin;
  HeaderList headers;  // ceux de la page (`Authorization`, `X-Emby-Token`) : manifeste seulement
};

/// Les manifestes déclarés sur le serveur (`/api/plugins/active`, en-têtes de la session), gardés
/// 5 min, 4 sessions au plus ; une lecture ratée ne déclare rien. Réseau injecté.
class PluginManifests {
 public:
  using Fetch = std::function<void(HttpRequest, HttpDone)>;
  explicit PluginManifests(Fetch fetch, std::function<int64_t()> now = nullptr)
      : fetch_(std::move(fetch)), now_(std::move(now)) {}
  void of(const ServerSession& session, const std::string& pluginId,
          std::function<void(std::optional<Manifest>)> done);
  void mediaHosts(const ServerSession& session, const std::string& pluginId,
                  std::function<void(std::vector<std::string>)> done);

 private:
  using Map = std::map<std::string, Manifest>;
  struct Cached {
    int64_t at;
    Map manifests;
  };
  int64_t now() const;
  Fetch fetch_;
  std::function<int64_t()> now_;
  std::vector<std::pair<std::string, Cached>> cache_;  // ordre d'insertion (plus ancien en tête)
  std::map<std::string, std::vector<std::function<void(const Map&)>>> loading_;
};

/// `runDelegated` : manifeste lu (en-têtes de la session pour CETTE lecture seulement), plafond,
/// puis exécution avec les seuls en-têtes de l'extension.
void runDelegated(const ServerSession& session, const std::string& pluginId, const Json& request,
                  PluginManifests& manifests, Quota& quota, Hop hop, std::function<int64_t()> now,
                  std::function<void(Outcome)> done);

}  // namespace tentacle::net::cf
