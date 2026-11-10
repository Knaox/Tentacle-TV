// Les récupérateurs du snapshot et des pochettes — `downloads/netFetch.ts` d'Electron, par
// `net::httpFetch` (axe reseau : CefURLRequest, sans cookies). Les réponses reviennent sur le
// fil hors ligne.

#include "net/cef_fetch.h"
#include "offline/glue/cef_transfer_net.h"
#include "offline/glue/offline_thread.h"

namespace tentacle::offline {
namespace {

/// Au-delà, la source est tenue pour morte (la valeur de l'agent `ureq` du Rust).
constexpr int kTimeoutMs = 20000;

void fetchInto(net::HttpRequest request, int64_t maxBytes, std::function<void(std::optional<Bytes>)> done) {
  request.timeoutMs = kTimeoutMs;
  // Borne APRÈS lecture chez Electron (`net.fetch` ne sait pas s'arrêter) ; ici dès qu'elle
  // est franchie : même verdict, un corps démesuré n'est pas la ressource attendue.
  request.maxBytes = maxBytes;
  net::httpFetch(std::move(request), [done = std::move(done)](net::HttpResponse response) {
    std::optional<Bytes> bytes;
    if (response.ok()) {
      bytes = Bytes(response.body.begin(), response.body.end());
    }
    thread::post([done, bytes = std::move(bytes)] { done(bytes); });
  });
}

}  // namespace

FetchBytes makeFetcher(const std::string& token) {
  return [token](const std::string& url, int64_t maxBytes, std::function<void(std::optional<Bytes>)> done) {
    net::HttpRequest request;
    request.url = url;
    // `X-Emby-Token` et pas `Bearer` : ces URL passent par le proxy `/api/jellyfin`.
    request.headers.emplace_back("X-Emby-Token", token);
    fetchInto(std::move(request), maxBytes, std::move(done));
  };
}

FetchBytes makePublicFetcher() {
  return [](const std::string& url, int64_t maxBytes, std::function<void(std::optional<Bytes>)> done) {
    if (url.rfind("https://", 0) != 0) {
      thread::post([done] { done(std::nullopt); });
      return;
    }
    net::HttpRequest request;
    request.url = url;  // aucun en-tête : le jeton ne quitte jamais le serveur Tentacle
    fetchInto(std::move(request), maxBytes, std::move(done));
  };
}

}  // namespace tentacle::offline
