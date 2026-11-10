// Portage de `clientFetch/clientFetch.test.ts` et `delegatedRun.test.ts` (bureau) : l'exécution
// par sauts revalidés, le plafond par extension, le manifeste lu par l'app, aucun identifiant du
// compte vers l'hôte joint ; plus les commandes `client_fetch_run` / `client_fetch_log`.
#include <deque>
#include <string>
#include <vector>

#include "check.h"
#include "net/client_fetch_commands.h"

using namespace tentacle::net;
using namespace tentacle::net::cf;

static const Manifest kManifest{{"music.example.com", "www.example.com"}, {"*.media.example.net"}};
static const Json kRequest{{"method", "POST"}, {"url", "https://music.example.com/api/search"},
                           {"headers", {{"Content-Type", "application/json"}}}, {"body", "{\"q\":1}"}, {"timeoutMs", 2000}};

struct Scripted {
  std::deque<HopResult> results;
  std::vector<HopRequest> seen;
  Hop hop() {
    return [this](HopRequest r, std::function<void(HopResult)> done) {
      seen.push_back(r);
      HopResult next;
      next.reason = "network";
      if (!results.empty()) {
        next = results.front();
        results.pop_front();
      }
      done(next);
    };
  }
};
static HopResult response(int status, std::optional<std::string> type, std::string body) {
  HopResult r;
  r.kind = HopResult::kResponse;
  r.status = status;
  r.contentType = std::move(type);
  r.body = std::move(body);
  return r;
}
static HopResult redirect(int status, std::string location) {
  HopResult r;
  r.kind = HopResult::kRedirect;
  r.status = status;
  r.location = std::move(location);
  return r;
}
static HopResult failure(std::string reason) {
  HopResult r;
  r.reason = std::move(reason);
  return r;
}
static Json run(Scripted& s, const Json& request = kRequest) {
  Json out;
  runClientFetch(request, kManifest, s.hop(), nullptr, [&](Outcome o) { out = o.toJson(); });
  return out;
}

int main() {
  // exécute une requête permise et rend statut, adresse finale, type et corps
  {
    Scripted s{{response(200, "application/json", "{\"ok\":true}")}};
    CHECK(run(s) == (Json{{"ok", true}, {"response", {{"status", 200}, {"url", "https://music.example.com/api/search"},
                                                       {"headers", {{"content-type", "application/json"}}}, {"body", "{\"ok\":true}"}}}}));
    CHECK(s.seen[0].method == "POST" && s.seen[0].body == std::optional<std::string>("{\"q\":1}"));
    CHECK(s.seen[0].maxBytes == limits::defaultMaxBytes);
  }
  // revalide CHAQUE redirection : un hôte non déclaré arrête tout
  {
    Scripted evil{{redirect(302, "https://evil.example.org/")}};
    CHECK(run(evil) == (Json{{"ok", false}, {"reason", "refused"}}));
    Scripted lan{{redirect(307, "http://192.168.1.1/")}};
    CHECK(run(lan) == (Json{{"ok", false}, {"reason", "refused"}}));
  }
  // suit une redirection permise ; 303 (et 302 après un POST) repart en GET sans corps
  {
    Scripted s{{redirect(303, "/next"), response(200, std::nullopt, "fin")}};
    CHECK(run(s) == (Json{{"ok", true}, {"response", {{"status", 200}, {"url", "https://music.example.com/next"},
                                                       {"headers", Json::object()}, {"body", "fin"}}}}));
    CHECK(s.seen[1].method == "GET" && !s.seen[1].body);
    Scripted keep{{redirect(307, "https://www.example.com/x"), response(200, std::nullopt, "")}};
    run(keep);
    CHECK(keep.seen[1].method == "POST" && keep.seen[1].body == std::optional<std::string>("{\"q\":1}"));
  }
  // trop de redirections : refusée
  {
    Scripted loop;
    for (int i = 0; i < 5; ++i) loop.results.push_back(redirect(302, "/again"));
    CHECK(run(loop) == (Json{{"ok", false}, {"reason", "refused"}}));
    CHECK(int(loop.seen.size()) == limits::maxRedirects + 1);
  }
  // juge la requête AVANT tout envoi (hôte, en-tête interdit)
  {
    Scripted s;
    Json other = kRequest;
    other["url"] = "https://other.example.org/";
    CHECK(run(s, other) == (Json{{"ok", false}, {"reason", "refused"}}));
    Json cookie = kRequest;
    cookie["headers"] = {{"Cookie", "x"}};
    CHECK(run(s, cookie) == (Json{{"ok", false}, {"reason", "refused"}}));
    CHECK(s.seen.empty());
  }
  // l'échec d'un saut passe tel quel (délai, taille, réseau)
  {
    Scripted a{{failure("tooLarge")}}, b{{failure("timeout")}};
    CHECK(run(a) == (Json{{"ok", false}, {"reason", "tooLarge"}}));
    CHECK(run(b) == (Json{{"ok", false}, {"reason", "timeout"}}));
  }
  // le plafond par extension : 4 en parallèle, 30 par minute, 300 par heure
  {
    int64_t t = 0;
    Quota quota([&] { return t; });
    std::vector<std::function<void()>> held;
    for (int i = 0; i < limits::maxParallel; ++i) held.push_back(quota.take("p"));
    CHECK(std::all_of(held.begin(), held.end(), [](auto& f) { return bool(f); }));
    CHECK(!quota.take("p"));
    CHECK(bool(quota.take("autre")));
    for (auto& r : held) r();
    for (int i = int(held.size()); i < limits::perMinute; ++i) quota.take("p")();
    CHECK(!quota.take("p"));
    t = 61'000;
    CHECK(bool(quota.take("p")));
  }
  // le manifeste lu par l'app : /api/plugins/active du serveur réglé, ses en-têtes, 5 min
  const std::string list = Json::array({{{"pluginId", "sillon"}, {"clientFetch", {{"hosts", kManifest.hosts}, {"mediaHosts", kManifest.mediaHosts}}}},
                                         {{"pluginId", "vigie"}},
                                         {{"pluginId", "mal"}, {"clientFetch", {{"hosts", {"localhost"}}}}}}).dump();
  {
    std::vector<HttpRequest> calls;
    int64_t t = 0;
    PluginManifests manifests([&](HttpRequest r, HttpDone done) {
      calls.push_back(r);
      HttpResponse resp;
      resp.received = true;
      resp.status = 200;
      resp.body = list;
      done(resp);
    }, [&] { return t; });
    const ServerSession session{"https://tentacle.example", {{"Authorization", "Bearer t"}}};
    std::optional<Manifest> got, vigie = Manifest{}, mal = Manifest{};
    manifests.of(session, "sillon", [&](auto m) { got = m; });
    manifests.of(session, "vigie", [&](auto m) { vigie = m; });
    manifests.of(session, "mal", [&](auto m) { mal = m; });
    CHECK(got == kManifest && !vigie && !mal);
    CHECK(calls.size() == 1 && calls[0].url == "https://tentacle.example/api/plugins/active");
    CHECK((calls[0].headers == HeaderList{{"Authorization", "Bearer t"}}));
    t = 6 * 60'000;
    manifests.of(session, "sillon", [](auto) {});
    CHECK(calls.size() == 2);
    // une lecture ratée ne déclare rien
    PluginManifests broken([](HttpRequest, HttpDone done) {
      HttpResponse resp;
      resp.received = true;
      resp.status = 500;
      done(resp);
    });
    std::optional<Manifest> none = Manifest{};
    broken.of({"https://t.example", {}}, "sillon", [&](auto m) { none = m; });
    CHECK(!none);
  }
  // aucun identifiant du compte vers l'hôte joint ; sans manifeste, rien ne part
  {
    std::vector<HttpRequest> manifestCalls;
    Scripted s{{response(200, std::nullopt, "ok")}};
    Commands commands([&](HttpRequest r, HttpDone done) {
      manifestCalls.push_back(r);
      HttpResponse resp;
      resp.received = true;
      resp.status = 200;
      resp.body = list;
      done(resp);
    }, s.hop());
    Json reply;
    const Json args{{"serverOrigin", "https://tentacle.example"},
                    {"headers", {{"Authorization", "Bearer jeton-du-compte"}, {"X-Emby-Token", "jeton-du-compte"}}},
                    {"pluginId", "sillon"},
                    {"request", {{"method", "POST"}, {"url", "https://music.example.com/api"}, {"kind", "play"},
                                 {"headers", {{"Content-Type", "application/json"}, {"User-Agent", "Navigateur"}}}, {"body", "{}"}}}};
    commands.run(args, bridge::Reply{[&](Json v) { reply = v; }, [&](std::string, std::string m) { reply = m; }});
    CHECK(reply["ok"] == true);
    CHECK(manifestCalls.size() == 1 && manifestCalls[0].headers.size() == 2);
    CHECK((s.seen[0].headers == HeaderList{{"Content-Type", "application/json"}, {"User-Agent", "Navigateur"}}));
    Json other = args;
    other["pluginId"] = "autre";
    commands.run(other, bridge::Reply{[&](Json v) { reply = v; }, [&](std::string, std::string m) { reply = m; }});
    CHECK(reply == (Json{{"ok", false}, {"reason", "refused"}}));
    CHECK(s.seen.size() == 1);
    // arguments refusés (adresse du serveur, identifiant) : rejet, rien ne part
    Json bad = args;
    bad["serverOrigin"] = "file:///x";
    std::string rejected;
    commands.run(bad, bridge::Reply{[](Json) {}, [&](std::string, std::string m) { rejected = m; }});
    CHECK(rejected.rfind("arguments invalides pour client_fetch_run", 0) == 0);
    // le journal : hôte, chemin, issue, jamais la requête ni la réponse
    Json log;
    commands.log(Json::object(), bridge::Reply{[&](Json v) { log = v; }, [](std::string, std::string) {}});
    CHECK(log.size() == 2 && log[0]["host"] == "music.example.com" && log[0]["path"] == "/api" && log[0]["outcome"] == 200);
    CHECK(log[1]["outcome"] == "refused" && log.dump().find("jeton") == std::string::npos);
  }
  return TEST_RESULT("client_fetch");
}
