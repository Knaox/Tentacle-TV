// Portage de `apps/desktop-electron/src/main/ipc/jellyfin.test.ts` : les chemins sont CONSTRUITS
// côté principal à partir de morceaux validés (jamais un chemin libre de la page), les
// arguments refusent toute évasion, le corps du PlaybackInfo revient tel quel.
#include <string>
#include <vector>

#include "check.h"
#include "net/jellyfin_relay.h"

using namespace tentacle::net;
using bridge::Json;

struct Call {
  HttpRequest request;
};

struct Bench {
  std::vector<Call> calls;
  int status = 200;
  std::string responseBody;
  bool networkDown = false;
  jellyfin::Relay relay{[this](HttpRequest r, HttpDone done) {
    calls.push_back({r});
    HttpResponse resp;
    resp.received = !networkDown;
    resp.status = networkDown ? 0 : status;
    resp.body = responseBody;
    done(resp);
  }};
};

struct Outcome {
  bool called = false, ok = false;
  Json value;
  std::string code, message;
};

static bridge::Reply capture(Outcome& o) {
  return bridge::Reply{[&o](Json v) { o.called = true; o.ok = true; o.value = std::move(v); },
                       [&o](std::string c, std::string m) { o.called = true; o.code = c; o.message = m; }};
}

static std::string header(const HttpRequest& r, const std::string& name) {
  for (const auto& [k, v] : r.headers) if (k == name) return v;
  return "<absent>";
}

int main() {
  const Json piArgs = {{"baseUrl", "https://serveur.example"}, {"itemId", "b79c162e7cd612a4"},
                       {"query", "UserId=u1&IsPlayback=true"}, {"token", "jeton"},
                       {"authHeader", "MediaBrowser …"}, {"body", "{\"DeviceProfile\":{}}"}};
  // jellyfin_playback_info : chemin construit CÔTÉ PRINCIPAL, statut + corps rendus
  {
    Bench b;
    b.responseBody = "{\"MediaSources\":[]}";
    Outcome o;
    b.relay.playbackInfo(piArgs, capture(o));
    CHECK(o.ok && o.value == (Json{{"status", 200}, {"body", "{\"MediaSources\":[]}"}}));
    CHECK_EQ(b.calls[0].request.url,
             std::string("https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo?UserId=u1&IsPlayback=true"));
    CHECK_EQ(header(b.calls[0].request, "Authorization"), std::string("MediaBrowser …, Token=\"jeton\""));
    CHECK_EQ(header(b.calls[0].request, "X-Emby-Token"), std::string("<absent>"));
    CHECK_EQ(header(b.calls[0].request, "Content-Type"), std::string("application/json"));
    CHECK_EQ(b.calls[0].request.method, std::string("POST"));
    CHECK(b.calls[0].request.body == std::optional<std::string>("{\"DeviceProfile\":{}}"));
    CHECK_EQ(b.calls[0].request.timeoutMs, 20'000);
  }
  // sans requête, pas de « ? » orphelin
  {
    Bench b;
    Json a = piArgs;
    a["query"] = "";
    Outcome o;
    b.relay.playbackInfo(a, capture(o));
    CHECK_EQ(b.calls[0].request.url, std::string("https://serveur.example/Items/b79c162e7cd612a4/PlaybackInfo"));
  }
  // les arguments refusent toute évasion de chemin (et une adresse qui n'est pas http(s))
  for (auto [field, value] : std::vector<std::pair<const char*, const char*>>{
           {"itemId", "../System"}, {"query", "a=1&b=/autre"}, {"query", "a=1#frag"},
           {"baseUrl", "file:///etc"}, {"baseUrl", "https://u:p@x.test"}, {"token", ""}}) {
    Bench b;
    Json a = piArgs;
    a[field] = value;
    Outcome o;
    b.relay.playbackInfo(a, capture(o));
    CHECK(o.called && !o.ok && o.code == "bad_args");
    CHECK(o.message.find("arguments invalides pour jellyfin_playback_info") == 0);
    CHECK(b.calls.empty());
  }
  // jellyfin_kill_encodings : DELETE avec deviceId et playSessionId ENCODÉS
  {
    Bench b;
    b.status = 204;
    Outcome o;
    b.relay.killEncodings({{"baseUrl", "https://serveur.example"}, {"deviceId", "appareil un"},
                           {"playSessionId", "ps&1"}, {"token", "jeton"}, {"authHeader", "MediaBrowser …"}},
                          capture(o));
    CHECK(o.ok && o.value == (Json{{"status", 204}}));
    CHECK_EQ(b.calls[0].request.url,
             std::string("https://serveur.example/Videos/ActiveEncodings?deviceId=appareil%20un&playSessionId=ps%261"));
    CHECK_EQ(b.calls[0].request.method, std::string("DELETE"));
    CHECK(!b.calls[0].request.body);
  }
  // jellyfin_session_post : liste FERMÉE ; chaque report noté avant l'envoi
  {
    Bench b;
    b.status = 204;
    std::vector<std::string> noted;
    int tracked = 0, finished = 0;
    b.relay.setSessionHooks([&](const jellyfin::SessionPost& p) { noted.push_back(p.path); },
                            [&]() -> std::function<void()> {
                              ++tracked;
                              return [&] { ++finished; };
                            });
    const Json base = {{"baseUrl", "https://serveur.example"}, {"token", "jeton"}, {"authHeader", "MediaBrowser …"}};
    Json a = base;
    a["path"] = "/Sessions/Playing";
    a["body"] = "{\"ItemId\":\"item1\",\"PlaySessionId\":\"ps1\",\"PositionTicks\":0}";
    Outcome o;
    b.relay.sessionPost(a, capture(o));
    CHECK(o.ok && o.value == (Json{{"status", 204}}));
    CHECK_EQ(b.calls[0].request.url, std::string("https://serveur.example/Sessions/Playing"));
    CHECK((noted == std::vector<std::string>{"/Sessions/Playing"}));
    CHECK(tracked == 1 && finished == 1);
    // refuse un chemin hors de la liste, sans rien retenir
    a["path"] = "/System/Restart";
    Outcome refused;
    b.relay.sessionPost(a, capture(refused));
    CHECK(!refused.ok && refused.message.find("refuse") != std::string::npos);
    CHECK(b.calls.size() == 1 && noted.size() == 1 && tracked == 1);
    // un échec réseau rejette (comme net.fetch)
    b.networkDown = true;
    a["path"] = "/Sessions/Playing/Progress";
    Outcome down;
    b.relay.sessionPost(a, capture(down));
    CHECK(down.called && !down.ok && down.code == "network");
    CHECK(tracked == 2 && finished == 2);  // un échec finit l'envoi suivi aussi
  }
  // les en-têtes selon la cible
  CHECK((jellyfin::requestHeaders("https://tentacle.example/api/jellyfin", "t", "MediaBrowser Token=\"t\"") ==
         HeaderList{{"X-Emby-Token", "t"}, {"X-Emby-Authorization", "MediaBrowser Token=\"t\""}}));
  CHECK((jellyfin::requestHeaders("https://tentacle.example/API/Jellyfin/", "t", "a") ==
         HeaderList{{"X-Emby-Token", "t"}, {"X-Emby-Authorization", "a"}}));
  CHECK((jellyfin::requestHeaders("http://jf.local:8096", "t", "MediaBrowser Client=\"C\", Token=\"t\"") ==
         HeaderList{{"Authorization", "MediaBrowser Client=\"C\", Token=\"t\""}}));
  CHECK((jellyfin::requestHeaders("http://jf.local:8096/jellyfin", "t", "MediaBrowser Client=\"C\"") ==
         HeaderList{{"Authorization", "MediaBrowser Client=\"C\", Token=\"t\""}}));
  return TEST_RESULT("jellyfin");
}
