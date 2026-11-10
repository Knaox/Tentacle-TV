// Portage de `apps/desktop-electron/src/main/octaveArt/artCache.test.ts` : une pochette ne se
// charge qu'UNE fois — servie depuis le disque ensuite, après une relance comme sans réseau ;
// jamais une page d'erreur gardée pour une image ; tout part à la déconnexion.
#include <algorithm>
#include <deque>
#include <filesystem>
#include <functional>
#include <string>
#include <vector>

#include "check.h"
#include "net/art_cache.h"
#include "net/art_policy.h"
#include "net/fs_platform.h"

using namespace tentacle::net;
using namespace tentacle::net::art;
namespace fs = std::filesystem;

static const std::string kJpeg = std::string("\xff\xd8\xff\xe0", 4) + std::string(60, '\x07');
static const std::string kSrv = "http://srv:3001/api/music/artwork/abc?tag=t1&size=128";
static int g_dirs = 0;

// Un cache sur un dossier jetable ; le réseau répond plus tard (file d'attente), comme une
// promesse : c'est ce qui permet de voir les demandes simultanées fusionnées.
struct Bench {
  fs::path root;
  int fetches = 0;
  std::function<std::optional<std::string>(const std::string&)> answer = [](const std::string&) { return kJpeg; };
  std::deque<std::function<void()>> pending;
  int64_t clock = 0;
  bool fakeClock = false;
  std::unique_ptr<ArtCache> cache;

  explicit Bench(fs::path dir = {}) {
    root = dir.empty() ? fs::temp_directory_path() / ("octave-art-" + std::to_string(currentPid()) + "-" + std::to_string(++g_dirs)) : dir;
    cache = make();
  }
  std::unique_ptr<ArtCache> make() {
    CacheDeps d;
    d.root = root;
    d.post = [](std::function<void()> f) { f(); };
    d.fetchUpstream = [this](const std::string& url, int64_t, FetchDone done) {
      ++fetches;
      pending.push_back([this, url, done] { done(answer(url)); });
    };
    d.now = [this] { return fakeClock ? clock : nowMs(); };
    return std::make_unique<ArtCache>(d);
  }
  std::optional<ServedArt> serve(const std::optional<std::string>& owner, const std::string& url, ArtCache* c = nullptr) {
    std::optional<ServedArt> out;
    bool called = false;
    (c ? c : cache.get())->serve(owner, url, [&](std::optional<ServedArt> a) { out = std::move(a); called = true; });
    flush();
    CHECK(called);
    return out;
  }
  void flush() {
    while (!pending.empty()) {
      auto f = std::move(pending.front());
      pending.pop_front();
      f();
    }
  }
};

int main() {
  // demandée une fois ; ensuite le disque, même avec un jeton renouvelé
  {
    Bench b;
    auto first = b.serve(std::string("srv|u1"), kSrv + "&api_key=A");
    CHECK(first && first->type == "image/jpeg" && !first->fromDisk);
    auto second = b.serve(std::string("srv|u1"), kSrv + "&api_key=B");
    CHECK(second && second->fromDisk);
    CHECK_EQ(b.fetches, 1);
    fs::remove_all(b.root);
  }
  // après une relance (un cache neuf sur le même dossier) et sans réseau : depuis le disque
  {
    Bench b;
    b.serve(std::string("srv|u1"), kSrv);
    Bench offline(b.root);
    offline.answer = [](const std::string&) { return std::nullopt; };
    auto again = offline.serve(std::string("srv|u1"), kSrv);
    CHECK(again && again->fromDisk);
    CHECK_EQ(offline.fetches, 0);
    fs::remove_all(b.root);
  }
  // des demandes simultanées ne font qu'une requête
  {
    Bench b;
    int answered = 0;
    for (int i = 0; i < 3; ++i) b.cache->serve(std::string("o"), kSrv, [&](std::optional<ServedArt> a) { answered += a ? 1 : 0; });
    b.flush();
    CHECK_EQ(answered, 3);
    CHECK_EQ(b.fetches, 1);
    fs::remove_all(b.root);
  }
  // rangé par identité : une autre identité a sa propre entrée
  {
    Bench b;
    b.serve(std::string("srv|u1"), kSrv);
    b.serve(std::string("srv|u2"), kSrv);
    CHECK_EQ(b.fetches, 2);
    std::vector<std::string> dirs;
    for (const auto& e : fs::directory_iterator(b.root)) dirs.push_back(e.path().filename().string());
    std::sort(dirs.begin(), dirs.end());
    std::vector<std::string> want = {ownerDirOf(std::string("srv|u1")), ownerDirOf(std::string("srv|u2"))};
    std::sort(want.begin(), want.end());
    CHECK(dirs == want);
    fs::remove_all(b.root);
  }
  // jamais une page d'erreur gardée pour une image, ni une adresse refusée demandée
  {
    Bench b;
    b.answer = [](const std::string&) { return std::string("<html>404 introuvable</html>"); };
    CHECK(!b.serve(std::string("o"), kSrv));
    CHECK(!b.serve(std::string("o"), "file:///etc/passwd"));
    CHECK_EQ(b.fetches, 1);
    // ni une image de plus de 6 Mo
    b.answer = [](const std::string&) { return kJpeg + std::string(kMaxBytes, '\0'); };
    CHECK(!b.serve(std::string("o"), "https://img.test/gros.jpg"));
    fs::remove_all(b.root);
  }
  // une image sans étiquette se relit après 30 jours
  {
    Bench b;
    b.fakeClock = true;
    b.clock = nowMs();
    b.serve(std::string("o"), "https://img.test/a.jpg");
    b.clock += kUntaggedMaxAgeMs + 60'000;
    b.serve(std::string("o"), "https://img.test/a.jpg");
    CHECK_EQ(b.fetches, 2);
    fs::remove_all(b.root);
  }
  // la déconnexion efface tout
  {
    Bench b;
    b.serve(std::string("o"), kSrv);
    b.cache->clear();
    b.serve(std::string("o"), kSrv);
    CHECK_EQ(b.fetches, 2);
    fs::remove_all(b.root);
  }
  // l'éviction suit l'heure d'accès : un fichier servi du disque est rajeuni
  {
    Bench b;
    b.fakeClock = true;
    b.clock = 1'000'000;
    b.serve(std::string("o"), kSrv);
    b.clock = 5'000'000;
    b.serve(std::string("o"), kSrv);
    const fs::path file = b.root / ownerDirOf(std::string("o")) / fileNameOf(*key(kSrv));
    CHECK(modifiedTimeMs(file) == std::optional<int64_t>(5'000'000));
    fs::remove_all(b.root);
  }
  return TEST_RESULT("art_cache");
}
