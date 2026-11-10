// L'axe réseau dans l'app (voir net_shell.h).

#include "net/net_shell.h"

#include <chrono>
#include <cstdio>
#include <deque>
#include <fstream>
#include <memory>
#include <mutex>
#include <sstream>

#include "app/app.h"
#include "glue/pont_shell.h"
#include "net/arg_check.h"
#include "net/cef_fetch.h"
#include "net/csp.h"
#include "net/farewell.h"
#include "net/jellyfin_relay.h"
#include "net/plugin_documents.h"
#include "registry.h"
#include "schemes/art_scheme.h"
#include "schemes/plugin_scheme.h"
#include "shell/app_scheme.h"
#include "shell/ipc.h"
#include "shell/paths.h"

namespace tentacle::reseau {
namespace {

std::unique_ptr<net::jellyfin::Relay> g_jellyfin;

// Le relevé du banc (`__shell.invoke('reseau.debug.trace')`) : méthode, chemin SANS requête
// (jamais un jeton), statut, durée — les 200 dernières requêtes natives des relais.
std::mutex g_traceMutex;
std::deque<bridge::Json> g_trace;

void traceRequest(const net::HttpRequest& r, const net::HttpResponse& resp, int64_t ms) {
  std::string path = r.url.substr(0, r.url.find('?'));
  std::lock_guard lock(g_traceMutex);
  g_trace.push_back({{"method", r.method}, {"url", path}, {"status", resp.received ? resp.status : 0},
                     {"error", resp.error}, {"ms", ms}});
  if (g_trace.size() > 200) g_trace.pop_front();
}

// Le réseau des relais : httpFetch, relevé pour le banc.
void tracedFetch(net::HttpRequest r, net::HttpDone done) {
  const auto start = std::chrono::steady_clock::now();
  net::HttpRequest copy = r;
  net::httpFetch(std::move(r), [copy, start, done = std::move(done)](net::HttpResponse resp) {
    const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count();
    traceRequest(copy, resp, ms);
    done(std::move(resp));
  });
}

// La CSP de l'application, empreintes calculées sur l'`index.html` réellement servi.
void installCsp() {
  const std::string root = appscheme::servedWebRoot();
  if (root.empty()) return;  // pas de front embarqué (mode des bancs : la CSP du serveur)
  std::ifstream in(std::filesystem::path(root) / "index.html", std::ios::binary);
  std::ostringstream html;
  html << in.rdbuf();
  const auto hashes = net::csp::inlineScriptHashes(html.str());
  const std::string pluginOrigin = std::string(appscheme::kScheme) + "://" + net::plugins::kPluginHost;
  appscheme::setAppCsp(net::csp::buildAppCsp(appscheme::kAppOrigin, pluginOrigin,
                                             "tentacle://local " + std::string(schemes::kArtOrigin), hashes));
  std::fprintf(stderr, "[reseau] CSP de %s : %zu script(s) inline admis par empreinte\n",
               appscheme::kAppOrigin, hashes.size());
}

void registerPluginCommands(bridge::Registry& reg) {
  reg.command("plugin_document_set", [](const bridge::Json& args, bridge::Reply reply) {
    net::ArgCheck a("plugin_document_set", args);
    const auto id = a.str("id");
    const auto html = a.str("html");
    if (id && !net::plugins::isValidPluginId(*id)) a.invalid("id", "identifiant de greffon invalide");
    if (html && net::plugins::utf16Length(*html) > net::plugins::kMaxHtmlChars) a.invalid("html", "trop long");
    if (!a.ok()) return reply.fail("bad_args", a.error());
    const auto url = net::plugins::setDocument(appscheme::kScheme, *id, *html);
    reply.ok(url ? bridge::Json(*url) : bridge::Json(nullptr));
  });
}

void registerJellyfinCommands(bridge::Registry& reg) {
  g_jellyfin = std::make_unique<net::jellyfin::Relay>(tracedFetch);
  connectFarewell(*g_jellyfin);  // l'adieu à Jellyfin (axe systeme), s'il est construit
  auto* relay = g_jellyfin.get();
  reg.command("jellyfin_session_post", [relay](const bridge::Json& a, bridge::Reply r) { relay->sessionPost(a, r); });
  reg.command("jellyfin_playback_info", [relay](const bridge::Json& a, bridge::Reply r) { relay->playbackInfo(a, r); });
  reg.command("jellyfin_kill_encodings", [relay](const bridge::Json& a, bridge::Reply r) { relay->killEncodings(a, r); });
}

}  // namespace

net::jellyfin::Relay* jellyfinRelay() { return g_jellyfin.get(); }

void install(AppContext& ctx) {
  // Le cache des pochettes d'Octave : celui d'Electron (<userData>/octave-art).
  schemes::registerArtScheme(paths::userData() / "octave-art");
  schemes::registerPluginScheme();
  installCsp();
  bridge::Registry& reg = pont::registry();
  registerPluginCommands(reg);
  registerJellyfinCommands(reg);
  ipc::registerHandler("reseau.debug.trace", [](const Json&, ipc::Responder r) {
    std::lock_guard lock(g_traceMutex);
    r.reply(bridge::Json(std::vector<bridge::Json>(g_trace.begin(), g_trace.end())));
  });
}

void shutdown() {}

}  // namespace tentacle::reseau
