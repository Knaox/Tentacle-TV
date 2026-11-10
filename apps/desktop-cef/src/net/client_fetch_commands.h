#pragma once
// `client_fetch_run` et `client_fetch_log` — portage de `ipc/clientFetch.ts` : la page reçoit le
// travail d'une extension par le canal de session et le passe ici ; l'app le juge contre le
// manifeste qu'elle lit ELLE-MÊME, le plafonne et l'exécute sans cookie. Le journal ne garde
// que l'hôte et le chemin (jamais la requête ni la réponse), 200 entrées.

#include <deque>
#include <memory>

#include "net/client_fetch_run.h"
#include "ports.h"

namespace tentacle::net::cf {

class Commands {
 public:
  Commands(PluginManifests::Fetch fetch, Hop hop, std::function<int64_t()> now = nullptr);

  void run(const bridge::Json& args, bridge::Reply reply);
  void log(const bridge::Json& args, bridge::Reply reply);

  PluginManifests& manifests() { return *manifests_; }

 private:
  std::shared_ptr<PluginManifests> manifests_;
  std::shared_ptr<Quota> quota_;
  Hop hop_;
  std::function<int64_t()> now_;
  std::shared_ptr<std::deque<bridge::Json>> log_ = std::make_shared<std::deque<bridge::Json>>();
};

}  // namespace tentacle::net::cf
