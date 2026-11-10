#pragma once
// Le réseau des transferts et des à-côtés, dans l'app : CefURLRequest (flux du média, sur le
// fil hors ligne) et `net::httpFetch` de l'axe reseau (petites ressources, DELETE).

#include <string>

#include "offline/core/sidecars.h"
#include "offline/core/stream_driver.h"

namespace tentacle::offline {

class CefTransferNet final : public TransferNet {
 public:
  /// Fil hors ligne seulement.
  std::function<void()> open(const std::string& url, const HeaderList& headers, std::shared_ptr<StreamSink> sink) override;
  void killTranscode(const std::string& url, const HeaderList& headers, std::function<void()> done) override;
};

/// Le récupérateur du snapshot (`netFetch.ts`) : `X-Emby-Token` (le proxy `/api/jellyfin` le
/// transmet à Jellyfin, qui ne comprend pas `Bearer`), 20 s au plus, borné à `maxBytes`.
FetchBytes makeFetcher(const std::string& token);
/// Sans AUCUN jeton : la pochette https d'un titre hors bibliothèque, chez un autre hôte.
FetchBytes makePublicFetcher();

}  // namespace tentacle::offline
