// Tests du cœur de « À l'écoute » (`Hub`) : quelle source est montrée, ce qui part vers
// l'OS, la pochette. Sans dépendance de test : un échec imprime sa ligne et le code de
// sortie compte les échecs.
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "media_session/artwork_fetch.h"
#include "media_session/media_session_hub.h"

using namespace tentacle::media_session;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

namespace {

struct Calls {
  int activate = 0, deactivate = 0;
  std::vector<NowPlaying> now;
  std::vector<bool> nowWithArt;
  std::vector<Playback> playback;
  std::vector<Controls> controls;
  std::vector<std::string> sessionNames;
};

class FakeBackend final : public Backend {
 public:
  explicit FakeBackend(Calls& c) : c_(c) {}
  void activate() override { c_.activate++; }
  void deactivate() override { c_.deactivate++; }
  void setNowPlaying(const NowPlaying& n, std::shared_ptr<const Artwork> a) override {
    c_.now.push_back(n);
    c_.nowWithArt.push_back(a != nullptr);
  }
  void setPlayback(const Playback& p) override { c_.playback.push_back(p); }
  void setControls(const Controls& k) override { c_.controls.push_back(k); }
  void setAudioSessionName(const std::string& n) override { c_.sessionNames.push_back(n); }

 private:
  Calls& c_;
};

struct World {
  Calls calls;
  double now = 1000;
  std::map<std::string, Hub::ArtworkDone> pending;
  int fetches = 0;
  Hub hub{std::make_unique<FakeBackend>(calls),
          [this](const std::string& url, Hub::ArtworkDone done) {
            fetches++;
            pending[url] = std::move(done);
          },
          [this] { return now; }};
  void deliver(const std::string& url, size_t bytes = 10) {
    auto it = pending.find(url);
    if (it == pending.end()) return;
    auto done = std::move(it->second);
    pending.erase(it);
    auto a = std::make_shared<Artwork>();
    a->bytes.assign(bytes, 0xFF);
    a->mime = "image/jpeg";
    done(a);
  }
};

NowPlaying np(const std::string& title, const std::string& art = "") {
  NowPlaying n;
  n.title = title;
  n.artworkUrl = art;
  return n;
}

Playback pb(Status s, double pos, double dur = 200000) {
  Playback p;
  p.status = s;
  p.positionMs = pos;
  p.durationMs = dur;
  return p;
}

}  // namespace

static void testShownOnlyWhenDescribed() {
  World w;
  w.hub.claim(Kind::Video, {});
  CHECK(!w.hub.shown());
  CHECK(w.calls.activate == 0);
  w.hub.setNowPlaying(Kind::Video, np("Film"));
  CHECK(w.hub.shown() == Kind::Video);
  CHECK(w.calls.activate == 1);
  CHECK(w.calls.now.size() == 1 && w.calls.now.back().title == "Film" && w.calls.now.back().kind == Kind::Video);
  w.hub.release(Kind::Video);
  CHECK(!w.hub.shown());
  CHECK(w.calls.deactivate == 1);
}

static void testPlayingSourceWins() {
  World w;
  std::vector<std::string> got;
  w.hub.claim(Kind::Music, [&](const CommandEvent&) { got.push_back("music"); });
  w.hub.setNowPlaying(Kind::Music, np("Chanson"));
  w.hub.setPlayback(Kind::Music, pb(Status::Paused, 0));
  w.hub.claim(Kind::Video, [&](const CommandEvent&) { got.push_back("video"); });
  w.hub.setNowPlaying(Kind::Video, np("Film"));
  // Personne ne joue : la dernière réclamée.
  CHECK(w.hub.shown() == Kind::Video);
  w.hub.setPlayback(Kind::Video, pb(Status::Paused, 0));
  w.hub.setPlayback(Kind::Music, pb(Status::Playing, 0));
  CHECK(w.hub.shown() == Kind::Music);
  w.hub.dispatch({Command::Toggle, 0});
  w.hub.setPlayback(Kind::Video, pb(Status::Playing, 0));
  CHECK(w.hub.shown() == Kind::Video);  // la plus récente à jouer
  w.hub.dispatch({Command::Next, 0});
  CHECK((got == std::vector<std::string>{"music", "video"}));
  CHECK(w.calls.activate == 1);  // une bascule entre sources ne recrée pas la session
}

static void testPositionOnlyOnJump() {
  World w;
  w.hub.claim(Kind::Music, {});
  w.hub.setNowPlaying(Kind::Music, np("A"));
  w.hub.setPlayback(Kind::Music, pb(Status::Playing, 0));
  const size_t base = w.calls.playback.size();
  CHECK(w.calls.playback.back().status == Status::Playing && w.calls.playback.back().atMs == 1000 && !w.calls.playback.back().seeked);
  // La lecture avance comme l'OS l'extrapole : rien ne part.
  for (int i = 1; i <= 8; i++) {
    w.now = 1000 + i * 250;
    w.hub.setPlayback(Kind::Music, pb(Status::Playing, i * 250 + 20));
  }
  CHECK(w.calls.playback.size() == base);
  // Un saut : part, marqué `seeked`.
  w.now = 3500;
  w.hub.setPlayback(Kind::Music, pb(Status::Playing, 90000));
  CHECK(w.calls.playback.size() == base + 1 && w.calls.playback.back().seeked);
  // Une pause : part (forme), sans saut.
  w.now = 3600;
  w.hub.setPlayback(Kind::Music, pb(Status::Paused, 90100));
  CHECK(w.calls.playback.size() == base + 2 && !w.calls.playback.back().seeked &&
        w.calls.playback.back().status == Status::Paused);
  // En pause, la barre ne bouge pas : un saut de 600 ms se voit.
  w.hub.setPlayback(Kind::Music, pb(Status::Paused, 90700));
  CHECK(w.calls.playback.size() == base + 3 && w.calls.playback.back().seeked);
  // La durée change (fichier mesuré) : part.
  w.hub.setPlayback(Kind::Music, pb(Status::Paused, 90700, 210000));
  CHECK(w.calls.playback.size() == base + 4);
}

static void testArtworkFetchedOnceAndOnlyForItsTitle() {
  World w;
  w.hub.claim(Kind::Music, {});
  w.hub.setNowPlaying(Kind::Music, np("A", "http://s/a.jpg"));
  CHECK(w.fetches == 1);
  CHECK(w.calls.nowWithArt.back() == false);
  // Le titre change avant la pochette : celle de A ne s'applique pas à B.
  w.hub.setNowPlaying(Kind::Music, np("B", "http://s/b.jpg"));
  w.deliver("http://s/a.jpg");
  CHECK(w.calls.now.back().title == "B" && w.calls.nowWithArt.back() == false);
  w.deliver("http://s/b.jpg");
  CHECK(w.calls.now.back().title == "B" && w.calls.nowWithArt.back() == true);
  // Un titre du même album (même pochette) : rien à télécharger.
  w.hub.setNowPlaying(Kind::Music, np("B2", "http://s/b.jpg"));
  CHECK(w.fetches == 2 && w.calls.nowWithArt.back() == true);
  // Revenir sur A : déjà en mémoire (remise par le téléchargement manqué plus haut).
  w.hub.setNowPlaying(Kind::Music, np("A", "http://s/a.jpg"));
  CHECK(w.fetches == 2 && w.calls.nowWithArt.back() == true);
  // Même description : rien ne repart.
  const size_t n = w.calls.now.size();
  w.hub.setNowPlaying(Kind::Music, np("A", "http://s/a.jpg"));
  CHECK(w.calls.now.size() == n);
}

static void testHiddenSourceStoresWithoutPushing() {
  World w;
  w.hub.claim(Kind::Video, {});
  w.hub.setNowPlaying(Kind::Video, np("Film"));
  w.hub.setPlayback(Kind::Video, pb(Status::Playing, 0));
  const size_t n = w.calls.now.size();
  w.hub.claim(Kind::Music, {});
  w.hub.setNowPlaying(Kind::Music, np("Chanson"));
  w.hub.setControls(Kind::Music, Controls{true, true, true});
  CHECK(w.hub.shown() == Kind::Video);  // la vidéo joue
  CHECK(w.calls.now.size() == n);
  w.hub.release(Kind::Video);
  CHECK(w.hub.shown() == Kind::Music);
  CHECK(w.calls.now.back().title == "Chanson");
  CHECK(w.calls.controls.back().next && w.calls.controls.back().seek);
  CHECK(w.calls.deactivate == 0);
}

static void testWithoutBackend() {
  double now = 0;
  Hub hub(nullptr, {}, [&] { return now; });
  CHECK(!hub.hasBackend());
  hub.claim(Kind::Video, {});
  hub.setNowPlaying(Kind::Video, np("Film", "http://x"));
  hub.setPlayback(Kind::Video, pb(Status::Playing, 0));
  hub.setAudioSessionName("Tentacle TV");
  CHECK(hub.shown() == Kind::Video);
}

static void testSessionName() {
  World w;
  w.hub.setAudioSessionName("Tentacle TV");
  CHECK(w.calls.sessionNames == std::vector<std::string>{"Tentacle TV"});
}

static void testArtworkRules() {
  auto bytes = [](std::string s) { return std::vector<uint8_t>(s.begin(), s.end()); };
  CHECK(sniffImage(bytes("\xFF\xD8\xFF\xE0rest")) == "image/jpeg");
  CHECK(sniffImage(bytes("\x89PNG\r\n\x1A\nrest")) == "image/png");
  CHECK(sniffImage(bytes(std::string("RIFF\x10\0\0\0WEBPVP8 ", 16))) == "image/webp");
  CHECK(sniffImage(bytes("<!DOCTYPE html>")).empty());  // une page d'erreur n'est pas une image
  CHECK(sniffImage({}).empty());
  CHECK(artworkUrlAllowed("http://srv:3001/api/music/artwork/1?api_key=x"));
  CHECK(artworkUrlAllowed("https://jf.example/Items/1/Images/Primary"));
  CHECK(artworkUrlAllowed("tentacle://art/?o=a&u=b"));
  CHECK(!artworkUrlAllowed("file:///etc/passwd"));
  CHECK(!artworkUrlAllowed("data:image/png;base64,AAAA"));
  CHECK(!artworkUrlAllowed("tentacle://app/index.html"));
}

int main() {
  testArtworkRules();
  testShownOnlyWhenDescribed();
  testPlayingSourceWins();
  testPositionOnlyOnJump();
  testArtworkFetchedOnceAndOnlyForItsTitle();
  testHiddenSourceStoresWithoutPushing();
  testWithoutBackend();
  testSessionName();
  if (failures == 0) std::printf("media_session : tous les tests passent\n");
  return failures == 0 ? 0 : 1;
}
