// L'axe réseau dans l'app (voir net_shell.h).

#include "net/net_shell.h"

#include <cstdio>
#include <fstream>
#include <memory>
#include <sstream>

#include "app/app.h"
#include "glue/pont_shell.h"
#include "net/arg_check.h"
#include "net/csp.h"
#include "net/plugin_documents.h"
#include "registry.h"
#include "schemes/art_scheme.h"
#include "schemes/plugin_scheme.h"
#include "shell/app_scheme.h"
#include "shell/paths.h"

namespace tentacle::reseau {
namespace {

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

}  // namespace

void install(AppContext& ctx) {
  // Le cache des pochettes d'Octave : celui d'Electron (<userData>/octave-art).
  schemes::registerArtScheme(paths::userData() / "octave-art");
  schemes::registerPluginScheme();
  installCsp();
  bridge::Registry& reg = pont::registry();
  registerPluginCommands(reg);
}

void shutdown() {}

}  // namespace tentacle::reseau
