// Le relais local des flux directs dans l'app : l'amont par CefURLRequest en flux (8 s sans
// octet : abandon, le `timeout` de Node), le direct en https vers des adresses publiques seulement
// (résolveur de Chromium, net/cef_hop.h), le serveur réglé sans restriction d'adresse.

#include <memory>
#include <mutex>

#include "net/cef_hop.h"
#include "net/direct_source.h"
#include "net/net_shell.h"
#include "shell/main_thread.h"

namespace tentacle::reseau {
namespace {

constexpr int kIdleTimeoutMs = 8'000;

struct Cancel {
  std::mutex m;
  bool cancelled = false;
  std::function<void()> inner;
};

std::function<void()> openUpstream(const std::string& url, const std::string& method, net::HeaderList headers,
                                   bool publicOnly, net::StreamHandler handler) {
  net::HttpRequest r;
  r.url = url;
  r.method = method;
  r.headers = std::move(headers);
  if (!publicOnly) return net::httpStream(std::move(r), kIdleTimeoutMs, std::move(handler));
  const auto parsed = net::parseHttpUrl(url);
  if (!parsed || parsed->scheme != "https") {
    if (handler.onEnd) handler.onEnd(false);
    return [] {};
  }
  auto state = std::make_shared<Cancel>();
  net::cf::resolveWithChromium(parsed->host, [state, r, handler](bool ok, std::vector<std::string> ips) mutable {
    bool refused = !ok || ips.empty();
    for (const std::string& ip : ips) refused = refused || net::cf::isPrivateAddress(ip);
    std::lock_guard lock(state->m);
    if (state->cancelled || refused) {
      if (handler.onEnd) handler.onEnd(false);  // adresse privée refusée : le repli joue
      return;
    }
    state->inner = net::httpStream(std::move(r), kIdleTimeoutMs, std::move(handler));
  });
  return [state] {
    std::lock_guard lock(state->m);
    state->cancelled = true;
    if (state->inner) state->inner();
  };
}

net::direct::Relay& relay() {
  static net::direct::Relay r(openUpstream);
  return r;
}

}  // namespace

void adoptDirectSource(net::cf::Json source, const std::string& trackKey,
                       std::optional<net::cf::ServerSession> session,
                       std::function<void(net::cf::Json source, bool adopted)> done) {
  net::cf::PluginManifests* manifests = pluginManifests();
  if (!manifests) {
    source.erase("direct");
    return done(std::move(source), false);
  }
  net::direct::adoptDirect(std::move(source), trackKey, session, *manifests, relay(), nullptr, std::move(done));
}

void setDirectCutListener(std::function<void(const std::string& localUrl)> onCut) {
  relay().setOnCut([onCut](const std::string& url) {
    postToMain([onCut, url] { if (onCut) onCut(url); });
  });
}

std::string directRelayOrigin() { return relay().origin(); }

net::direct::Stats directRelayStats() { return relay().stats(); }

}  // namespace tentacle::reseau
