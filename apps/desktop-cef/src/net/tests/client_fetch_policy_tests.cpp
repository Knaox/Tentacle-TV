// Portage de `packages/shared/src/plugins/pluginClientFetch.test.ts` (le contrat des requêtes
// déléguées) et des adresses privées de `clientFetch.test.ts` (bureau).
#include <string>
#include <vector>

#include "check.h"
#include "net/client_fetch_policy.h"

using namespace tentacle::net;
using namespace tentacle::net::cf;

static const Manifest kManifest{{"music.example.com", "www.example.com"}, {"*.media.example.net"}};
static Json ok() {
  return Json{{"method", "POST"}, {"url", "https://music.example.com/api/search?x=1"},
              {"headers", {{"Content-Type", "application/json"}}}, {"body", "{}"}};
}
static Json with(Json r, const char* k, Json v) {
  r[k] = std::move(v);
  return r;
}
static bool mentions(const std::optional<std::string>& m, const char* word) {
  return m && m->find(word) != std::string::npos;
}

int main() {
  // le manifeste : noms publics exacts, un joker en tête pour les flux seulement
  CHECK((readManifest({{"hosts", {"music.example.com"}}, {"mediaHosts", {"*.media.example.net"}}}) ==
         Manifest{{"music.example.com"}, {"*.media.example.net"}}));
  CHECK((readManifest({{"hosts", {"music.example.com"}}}) == Manifest{{"music.example.com"}, {}}));
  for (const char* bad : {"localhost", "127.0.0.1", "192.168.1.10", "nas.local", "printer.lan", "*.example.com",
                          "Example.com", "example", "a..b.com", "exa mple.com", "[::1]"}) {
    if (readManifest({{"hosts", {"ok.example.com", bad}}})) std::fprintf(stderr, "  accepté à tort : %s\n", bad);
    CHECK(!readManifest({{"hosts", {"ok.example.com", bad}}}));
  }
  CHECK(!readManifest({{"hosts", Json::array()}}));
  CHECK(!readManifest({{"hosts", {"ok.example.com"}}, {"mediaHosts", {"*.local"}}}));
  {
    Json many = Json::array();
    for (size_t i = 0; i <= limits::maxHosts; ++i) many.push_back("h" + std::to_string(i) + ".example.com");
    CHECK(!readManifest({{"hosts", many}}));
  }
  CHECK(!readManifest(nullptr));
  CHECK(isDeclarableHost("music.youtube-like.com"));
  CHECK(!isDeclarableHost("10.0.0.1"));
  CHECK(!isDeclarableHost("router.home"));

  // l'adresse : joker sur les sous-domaines seulement ; https seul, sans identifiants ni port
  CHECK(hostAllowed("rr1---sn-x.media.example.net", kManifest.mediaHosts));
  CHECK(!hostAllowed("media.example.net", kManifest.mediaHosts));
  CHECK(!hostAllowed("evilmedia.example.net", kManifest.mediaHosts));
  CHECK(hostAllowed("music.example.com", kManifest.hosts));
  CHECK(!hostAllowed("sub.music.example.com", kManifest.hosts));
  CHECK(allowedUrl("https://music.example.com/x", kManifest.hosts).has_value());
  for (const char* bad : {"http://music.example.com/x", "https://u:p@music.example.com/x", "https://music.example.com:8443/x",
                          "file:///etc/passwd", "https://music.example.com.evil.org/x", "pas une adresse"}) {
    CHECK(!allowedUrl(bad, kManifest.hosts));
  }
  CHECK(allowedUrl("https://music.example.com:443/x", kManifest.hosts).has_value());  // port par défaut : vide

  // la requête : ordinaire permise ; hôte, méthode, corps, délai, taille hors bornes refusés
  CHECK(!checkRequest(ok(), kManifest));
  CHECK(!checkRequest({{"method", "GET"}, {"url", "https://www.example.com/"}}, kManifest));
  CHECK(mentions(checkRequest(with(ok(), "url", "https://other.example.org/"), kManifest), "hôtes"));
  CHECK(mentions(checkRequest(with(ok(), "method", "PUT"), kManifest), "méthode"));
  CHECK(mentions(checkRequest({{"method", "GET"}, {"url", ok()["url"]}, {"body", "x"}}, kManifest), "corps"));
  {
    std::string big;
    for (size_t i = 0; i < limits::maxRequestBody; ++i) big += "\xC3\xA9";  // « é » : 2 octets
    CHECK(mentions(checkRequest(with(ok(), "body", big), kManifest), "corps"));
  }
  CHECK(mentions(checkRequest(with(ok(), "timeoutMs", 60'000), kManifest), "délai"));
  CHECK(mentions(checkRequest(with(ok(), "maxBytes", 50 * 1024 * 1024), kManifest), "taille"));
  CHECK(checkRequest(nullptr, kManifest).has_value());
  // en-têtes de connexion, d'authentification et du cœur
  for (const char* name : {"Cookie", "authorization", "Host", "Proxy-Authorization", "Sec-Fetch-Site",
                           "X-Tentacle-User-Id", "X-Emby-Token", "Content-Length", "X-Forwarded-For"}) {
    CHECK(mentions(checkRequest(with(ok(), "headers", {{name, "x"}}), kManifest), "interdit"));
  }
  CHECK(mentions(checkRequest(with(ok(), "headers", {{"X-A", "a\r\nCookie: b"}}), kManifest), "valeur"));
  {
    Json many = Json::object();
    for (size_t i = 0; i <= limits::maxHeaders; ++i) many["X-H" + std::to_string(i)] = "v";
    CHECK(mentions(checkRequest(with(ok(), "headers", many), kManifest), "trop"));
  }
  // la nature (geste ou fond)
  CHECK(!checkRequest(with(ok(), "kind", "play"), kManifest));
  CHECK(!checkRequest(with(ok(), "kind", "prefetch"), kManifest));
  CHECK(checkRequest(with(ok(), "kind", "urgent"), kManifest) == std::optional<std::string>("nature refusée"));
  CHECK(mentions(checkRequest(with(ok(), "burst", true), kManifest), "rafale"));

  // les adresses privées (bureau) : réseau local, boucle, lien local, CGNAT, multidiffusion
  for (const char* ip : {"10.0.0.1", "127.0.0.1", "192.168.1.1", "172.16.5.4", "169.254.1.1", "100.64.0.1", "0.0.0.0",
                         "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1", "pas une ip"}) {
    if (!isPrivateAddress(ip)) std::fprintf(stderr, "  publique à tort : %s\n", ip);
    CHECK(isPrivateAddress(ip));
  }
  for (const char* ip : {"142.250.74.46", "8.8.8.8", "172.32.0.1", "2a00:1450:4007:80e::200e"}) CHECK(!isPrivateAddress(ip));

  // résolution d'une redirection (`new URL(location, base)`)
  const WebUrl base = *parseHttpUrl("https://music.example.com/api/search?x=1");
  CHECK(resolveUrl(base, "/next")->href() == "https://music.example.com/next");
  CHECK(resolveUrl(base, "next?y=2")->href() == "https://music.example.com/api/next?y=2");
  CHECK(resolveUrl(base, "//www.example.com/a")->href() == "https://www.example.com/a");
  CHECK(resolveUrl(base, "?z=3")->href() == "https://music.example.com/api/search?z=3");
  CHECK(resolveUrl(base, "../up")->href() == "https://music.example.com/up");
  CHECK(!resolveUrl(base, "ftp://x/y"));
  return TEST_RESULT("client_fetch_policy");
}
