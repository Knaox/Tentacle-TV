// Octave — tentacle://art (voir art_scheme.h et serveArt.ts).

#include "schemes/art_scheme.h"

#include <cstdio>
#include <memory>

#include "include/cef_parser.h"
#include "include/cef_scheme.h"
#include "net/art_cache.h"
#include "net/cef_fetch.h"
#include "net/cef_tasks.h"
#include "net/web_url.h"
#include "schemes/buffered_handler.h"
#include "shell/app_scheme.h"

namespace tentacle::schemes {
namespace {

/// Au-delà, la source est tenue pour morte (une pochette, pas un média).
constexpr int kFetchTimeoutMs = 15'000;

std::shared_ptr<net::art::ArtCache>& artCache() {
  static std::shared_ptr<net::art::ArtCache> cache;
  return cache;
}

CefResponse::HeaderMap corsHeaders() {
  CefResponse::HeaderMap h;
  h.emplace("Access-Control-Allow-Origin", appscheme::kAppOrigin);
  // Comme Electron : toute réponse de tentacle:// hors greffons porte la CSP de l'application.
  if (std::string csp = appscheme::appCsp(); !csp.empty()) h.emplace("Content-Security-Policy", csp);
  return h;
}

void handleArt(CefRefPtr<CefRequest> request, Respond respond) {
  CefURLParts parts;
  CefParseURL(request->GetURL(), parts);
  const std::string path = CefString(&parts.path).ToString();
  const std::string method = request->GetMethod().ToString();
  std::shared_ptr<net::art::ArtCache> cache = artCache();
  if (method == "POST" && path == "/clear") {
    net::postToDisk([cache, respond] {
      cache->clear();
      respond(emptyResponse(204, corsHeaders()));
    });
    return;
  }
  if (method != "GET") return respond(emptyResponse(405, corsHeaders()));
  const net::FormParams params = net::parseFormQuery(CefString(&parts.query).ToString());
  const std::optional<std::string> upstream = net::formParam(params, "u");
  if (!upstream || upstream->empty()) return respond(emptyResponse(400, corsHeaders()));
  const std::optional<std::string> owner = net::formParam(params, "o");
  net::postToDisk([cache, owner, upstream, respond] {
    cache->serve(owner, *upstream, [respond](std::optional<net::art::ServedArt> art) {
      if (!art) return respond(emptyResponse(404, corsHeaders()));
      SchemeResponse r;
      r.mimeType = art->type;
      r.headers = corsHeaders();
      r.headers.emplace("Cache-Control", "private, max-age=31536000, immutable");
      r.headers.emplace("X-Octave-Art", art->fromDisk ? "disk" : "network");
      r.body = std::move(art->bytes);
      respond(std::move(r));
    });
  });
}

class ArtFactory final : public CefSchemeHandlerFactory {
 public:
  CefRefPtr<CefResourceHandler> Create(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, const CefString&,
                                       CefRefPtr<CefRequest>) override {
    return new BufferedHandler(handleArt);
  }
  IMPLEMENT_REFCOUNTING(ArtFactory);
};

}  // namespace

void registerArtScheme(const std::filesystem::path& root) {
  net::art::CacheDeps deps;
  deps.root = root;
  deps.post = [](std::function<void()> task) { net::postToDisk(std::move(task)); };
  deps.fetchUpstream = [](const std::string& url, int64_t maxBytes, net::art::FetchDone done) {
    net::HttpRequest r;
    r.url = url;
    r.maxBytes = maxBytes;
    r.timeoutMs = kFetchTimeoutMs;
    net::httpFetch(std::move(r), [done](net::HttpResponse response) {
      if (response.ok()) {
        done(std::move(response.body));
      } else {
        done(std::nullopt);
      }
    });
  };
  artCache() = std::make_shared<net::art::ArtCache>(std::move(deps));
  CefRegisterSchemeHandlerFactory(appscheme::kScheme, kArtHost, new ArtFactory());
  std::fprintf(stderr, "[reseau] %s : cache %s\n", kArtOrigin, root.string().c_str());
}

}  // namespace tentacle::schemes
