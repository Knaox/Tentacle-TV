// Portage de `ipc/mediaWarm.test.ts` : le préchargement ne lit QUE des flux de lecture, par
// petites plages, jamais le fichier entier, et pas deux fois.
#include <deque>
#include <string>
#include <vector>

#include "check.h"
#include "net/media_warm.h"

using namespace tentacle::net;
using namespace tentacle::net::warm;

static const std::string ID = "4c1205919577693884f42a60f9b331de";
static const std::string URL_OK = "http://172.16.1.30:8096/jellyfin/Videos/" + ID + "/stream?Static=true&MediaSourceId=" + ID + "&ApiKey=secret";

struct Server {
  int status = 206;
  std::vector<HttpRequest> calls;
  std::deque<std::function<void()>> pending;  // les réponses arrivent plus tard, comme le réseau
  int aborted = 0;
  OpenStream opener() {
    return [this](HttpRequest r, StreamHandler h) {
      calls.push_back(r);
      auto cut = std::make_shared<bool>(false);
      pending.push_back([this, h, cut] {
        h.onHead(status, {});
        if (*cut) return h.onEnd(false);
        h.onData(std::string(1024, 'x'));
        h.onData(std::string(1024, 'x'));
        h.onEnd(true);
      });
      return std::function<void()>([this, cut] { *cut = true; ++aborted; });
    };
  }
  void flush() {
    while (!pending.empty()) {
      auto f = pending.front();
      pending.pop_front();
      f();
    }
  }
};

int main() {
  // un flux de lecture, une ou deux plages bornées : accepté
  CHECK(!refuseWarm(URL_OK, {{0, 1023}, {5000, 5999}}));
  // tout ce qui n'est pas un flux de lecture
  CHECK(refuseWarm("file:///etc/passwd", {{0, 1}}).has_value());
  CHECK(refuseWarm("http://h/Items/" + ID + "/Images/Primary", {{0, 1}}).has_value());
  CHECK(refuseWarm("pas une url", {{0, 1}}).has_value());
  // des plages absentes, trop nombreuses, à l'envers ou trop longues
  CHECK(refuseWarm(URL_OK, {}).has_value());
  CHECK(refuseWarm(URL_OK, {{0, 1}, {2, 3}, {4, 5}}).has_value());
  CHECK(refuseWarm(URL_OK, {{10, 5}}).has_value());
  CHECK(refuseWarm(URL_OK, {{-1, 5}}).has_value());
  CHECK(refuseWarm(URL_OK, {{0, kMaxRangeBytes}}).has_value());

  // chaque plage par un Range, le 206 lu jusqu'au bout
  {
    Server srv;
    std::vector<std::string> traces;
    MediaWarmer warmer(srv.opener(), [] { return int64_t(0); }, [&](std::string t) { traces.push_back(t); });
    CHECK(warmer.warm(URL_OK, {{0, 1023}, {9000, 10023}}));
    srv.flush();
    CHECK(srv.calls.size() == 2);
    CHECK(srv.calls[0].headers == (HeaderList{{"Range", "bytes=0-1023"}}));
    CHECK(srv.calls[1].headers == (HeaderList{{"Range", "bytes=9000-10023"}}));
    CHECK(srv.calls[0].timeoutMs == 15'000 && !srv.calls[0].useCache);
    CHECK(traces.size() == 1 && traces[0] == "préchargement 4c120591 : 2 Kio · 2 Kio en 0 ms");
  }
  // un 200 — le fichier entier — est coupé aussitôt
  {
    Server srv;
    srv.status = 200;
    std::vector<std::string> traces;
    MediaWarmer warmer(srv.opener(), [] { return int64_t(0); }, [&](std::string t) { traces.push_back(t); });
    warmer.warm(URL_OK, {{0, 1023}});
    srv.flush();
    CHECK(srv.aborted == 1);
    CHECK(traces.size() == 1 && traces[0].find("refusé (200)") != std::string::npos);
  }
  // la même demande n'est rejouée qu'après dix minutes, et deux au plus sont en vol
  {
    Server srv;
    int64_t now = 0;
    MediaWarmer warmer(srv.opener(), [&] { return now; }, nullptr);
    CHECK(warmer.warm(URL_OK, {{0, 7}}));
    CHECK(!warmer.warm(URL_OK, {{0, 7}}));
    CHECK(warmer.warm(URL_OK, {{8, 15}}));
    CHECK(!warmer.warm(URL_OK, {{16, 23}}));
    srv.flush();
    CHECK(warmer.warm(URL_OK, {{16, 23}}));
    srv.flush();
    now = 10 * 60'000;
    CHECK(warmer.warm(URL_OK, {{0, 7}}));
  }
  // la commande : refus motivé, « en cours », « écarté »
  {
    Server srv;
    MediaWarmer warmer(srv.opener(), [] { return int64_t(0); }, nullptr);
    std::string got;
    const bridge::Reply reply{[&](bridge::Json v) { got = v.get<std::string>(); }, [&](std::string, std::string m) { got = m; }};
    handleMediaWarm(warmer, {{"url", URL_OK}, {"ranges", {{0, 1023}}}}, reply);
    CHECK(got == "en cours");
    handleMediaWarm(warmer, {{"url", URL_OK}, {"ranges", {{0, 1023}}}}, reply);
    CHECK(got == "écarté");
    handleMediaWarm(warmer, {{"url", "file:///etc/passwd"}, {"ranges", {{0, 1}}}}, reply);
    CHECK(got.rfind("media_warm : ", 0) == 0);
    handleMediaWarm(warmer, {{"url", URL_OK}, {"ranges", {{0.5, 1}}}}, reply);
    CHECK(got.rfind("arguments invalides pour media_warm", 0) == 0);
  }
  return TEST_RESULT("media_warm");
}
