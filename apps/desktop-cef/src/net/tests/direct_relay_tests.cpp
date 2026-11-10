// Portage de `clientFetch/directRelay.test.ts` : le relais local des flux directs (vrais sockets
// sur 127.0.0.1, amont simulé) et l'adoption d'une source directe.
#include <map>
#include <regex>
#include <mutex>
#include <string>
#include <vector>

#include "check.h"
#include "net/direct_source.h"
#include "net/fs_platform.h"
#include "net/local_socket.h"

using namespace tentacle::net;
using namespace tentacle::net::direct;

struct Seen {
  std::string url;
  HeaderList headers;
  bool publicOnly;
};
struct Upstream {
  std::mutex m;
  std::vector<Seen> seen;
  std::function<std::pair<int, std::string>(const std::string& url, int call)> answer;
  OpenUpstream opener() {
    return [this](const std::string& url, const std::string&, HeaderList h, bool publicOnly, StreamHandler sh) {
      int call;
      {
        std::lock_guard l(m);
        call = int(seen.size());
        seen.push_back({url, h, publicOnly});
      }
      auto [status, body] = answer(url, call);
      sh.onHead(status, {{"Content-Type", "audio/webm"}, {"Accept-Ranges", "bytes"}, {"Set-Cookie", "jamais=1"},
                         {"Content-Length", std::to_string(body.size())}});
      if (!body.empty()) sh.onData(body);
      sh.onEnd(true);
      return std::function<void()>([] {});
    };
  }
  std::vector<Seen> calls(bool direct) {
    std::lock_guard l(m);
    std::vector<Seen> out;
    for (const auto& s : seen) if (s.publicOnly == direct) out.push_back(s);
    return out;
  }
};
struct Got {
  int status = 0;
  std::string head, body;
};
static Got get(const std::string& url, const std::string& range = "") {
  const auto u = parseHttpUrl(url);
  const sock::Handle s = sock::connectLoopback(std::stoi(u->port));
  std::string req = "GET " + u->path + " HTTP/1.1\r\nHost: 127.0.0.1\r\n" + (range.empty() ? "" : "Range: " + range + "\r\n") + "\r\n";
  sock::sendAll(s, req);
  std::string all;
  char buf[4096];
  for (long n; (n = sock::receive(s, buf, sizeof buf)) > 0;) all.append(buf, size_t(n));
  sock::shutdownAndClose(s);
  Got g;
  const size_t sep = all.find("\r\n\r\n");
  g.head = all.substr(0, sep);
  g.body = sep == std::string::npos ? "" : all.substr(sep + 4);
  if (all.size() > 12) g.status = std::stoi(all.substr(9, 3));
  return g;
}
static std::string header(const HeaderList& h, const char* name) {
  for (const auto& [k, v] : h) if (toLowerAscii(k) == name) return v;
  return "<absent>";
}

int main() {
  const std::string D = "https://rr1.media.example.net", S = "http://serveur.test";
  // sert le direct SANS les en-têtes du serveur, Range transmis, en-têtes de réponse filtrés
  {
    Upstream up;
    up.answer = [&](const std::string& url, int) { return url.rfind(D, 0) == 0 ? std::pair{206, std::string("OCTETS-DIRECTS")} : std::pair{206, std::string("SERVEUR")}; };
    Relay relay(up.opener());
    const std::string local = relay.adopt(D + "/videoplayback?x=1", S + "/stream", {{"X-Emby-Token", "secret"}});
    CHECK(std::regex_match(local, std::regex("^http://127\\.0\\.0\\.1:\\d+/d/[A-Za-z0-9_-]{43}$")));
    const Got r = get(local, "bytes=0-");
    CHECK(r.status == 206 && r.body == "OCTETS-DIRECTS");
    CHECK(r.head.find("et-Cookie") == std::string::npos && r.head.find("content-type: audio/webm") != std::string::npos);
    const auto direct = up.calls(true);
    CHECK(direct.size() == 1 && header(direct[0].headers, "range") == "bytes=0-");
    for (const char* n : {"x-emby-token", "authorization", "cookie", "x-emby-authorization", "x-mediabrowser-token"}) CHECK(header(direct[0].headers, n) == "<absent>");
    CHECK(direct[0].url == D + "/videoplayback?x=1");
    CHECK(up.calls(false).empty());
    CHECK((relay.stats() == Stats{1, 0, 0}));
  }
  // direct refusé AVANT le premier octet : repli sur le serveur (ses en-têtes), puis tout du serveur
  {
    Upstream up;
    up.answer = [&](const std::string& url, int) { return url.rfind(D, 0) == 0 ? std::pair{403, std::string()} : std::pair{200, std::string("SERVEUR")}; };
    Relay relay(up.opener());
    const std::string local = relay.adopt(D + "/v", S + "/stream", {{"X-Emby-Token", "secret"}});
    const Got r = get(local);
    CHECK(r.status == 200 && r.body == "SERVEUR");
    auto server = up.calls(false);
    CHECK(header(server[0].headers, "x-emby-token") == "secret");
    CHECK(server[0].url == S + "/stream?direct=failed");  // l'échec du direct signalé, une fois
    get(local, "bytes=10-");
    server = up.calls(false);
    CHECK(up.calls(true).size() == 1);
    CHECK(header(server[1].headers, "range") == "bytes=10-" && server[1].url == S + "/stream");
    CHECK(relay.stats().fallbacks == 1);
  }
  // direct coupé APRÈS des octets servis : 502 à la suite, la réouverture lit le serveur (S5)
  {
    Upstream up;
    up.answer = [&](const std::string& url, int call) {
      if (url.rfind(D, 0) == 0) return call == 0 ? std::pair{206, std::string("DEBUT")} : std::pair{403, std::string()};
      return std::pair{206, std::string("SERVEUR")};
    };
    Relay relay(up.opener());
    std::vector<std::string> cuts;
    std::mutex cm;
    relay.setOnCut([&](const std::string& u) { std::lock_guard l(cm); cuts.push_back(u); });
    const std::string local = relay.adopt(D + "/v", S + "/s", {});
    CHECK(get(local).body == "DEBUT");
    CHECK(get(local, "bytes=5-").status == 502);
    CHECK(get(local, "bytes=9-").status == 502);
    CHECK(up.calls(false).empty());
    CHECK(relay.stats().direct == 1 && relay.stats().cuts == 1);
    CHECK(cuts == std::vector<std::string>{local});
    const Got reopened = get(local, "bytes=0-");
    CHECK(reopened.status == 206 && reopened.body == "SERVEUR");
    CHECK(up.calls(false)[0].url == S + "/s?direct=failed");
    CHECK(get(local, "bytes=4-").body == "SERVEUR");
    CHECK(up.calls(false)[1].url == S + "/s");
    CHECK(up.calls(true).size() == 2);
  }
  // jeton inconnu : 404
  {
    Upstream up;
    up.answer = [](const std::string&, int) { return std::pair{200, std::string()}; };
    Relay relay(up.opener());
    CHECK(get(relay.origin() + "/d/" + std::string(43, 'a')).status == 404);
  }
  // withDirectFailed : searchParams.set puis sérialisation du formulaire
  CHECK(withDirectFailed("http://s/a?x=1&direct=ok&direct=2") == "http://s/a?x=1&direct=failed");
  CHECK(withDirectFailed("https://s/a?q=a%20b") == "https://s/a?q=a+b&direct=failed");

  // adoption : seulement pour un hôte déclaré par l'extension du titre, en https, pas sur le point d'expirer
  {
    cf::PluginManifests manifests([](HttpRequest, HttpDone done) {
      HttpResponse r;
      r.received = true;
      r.status = 200;
      r.body = R"([{"pluginId":"sillon","clientFetch":{"hosts":["music.example.com"],"mediaHosts":["*.media.example.net"]}}])";
      done(r);
    });
    Upstream up;
    up.answer = [](const std::string&, int) { return std::pair{200, std::string()}; };
    Relay relay(up.opener());
    const cf::ServerSession session{"https://tentacle.example", {{"X-Emby-Token", "t"}}};
    const cf::Json source{{"url", "https://tentacle.example/api/plugins/sillon/music/stream/x"}, {"origin", "plugin"}, {"complete", false}};
    const auto adopt = [&](const std::string& url, const std::string& key, cf::Json expiresAt, bool withSession = true) {
      cf::Json s = source;
      s["direct"] = {{"url", url}, {"expiresAt", expiresAt}};
      std::pair<cf::Json, bool> out;
      adoptDirect(s, key, withSession ? std::optional(session) : std::nullopt, manifests, relay, nullptr,
                  [&](cf::Json src, bool adopted) { out = {src, adopted}; });
      return out;
    };
    auto ok = adopt("https://rr1.media.example.net/v?x", "ext:sillon:abc", nullptr);
    CHECK(ok.second && ok.first["url"].get<std::string>().rfind("http://127.0.0.1:", 0) == 0 && !ok.first.contains("direct"));
    for (auto [url, key] : std::vector<std::pair<const char*, const char*>>{
             {"https://evil.example.org/v", "ext:sillon:abc"}, {"http://rr1.media.example.net/v", "ext:sillon:abc"},
             {"https://rr1.media.example.net/v", "ext:autre:abc"}, {"https://rr1.media.example.net/v", "jf:123"}}) {
      auto refused = adopt(url, key, nullptr);
      CHECK(!refused.second && refused.first == source);
    }
    const double soon = double(nowMs() + 5'000);
    CHECK(!adopt("https://rr1.media.example.net/v", "ext:sillon:abc", soon).second);
    CHECK(!adopt("https://rr1.media.example.net/v", "ext:sillon:abc", soon, false).second);
  }
  return TEST_RESULT("direct_relay");
}
