// Les cas soulevés par la relecture indépendante du 04/11 : flux mal typé, fermeture propre
// pendant la période d'essai, version retirée après préparation, retour arrière impossible,
// voile qui ne revient pas à chaque essai, taille imposée, contrôle qui ne masque pas « prête ».
#include <filesystem>
#include <string>

#include "tests/check.h"
#include "tests/fake_platform.h"
#include "update/engine.h"

using namespace tentacle::update;
using namespace tentacle::update::testing;

namespace {

const std::string kUrl = "https://example.org/a.tar.xz";

std::string manifest(const char* version, const char* severity, int64_t issuedAt = 100,
                     const std::string& body = "archive", uint64_t size = 0) {
  Sha256 h;
  h.update(body.data(), body.size());
  return nlohmann::json{{"version", version}, {"channel", "stable"}, {"severity", severity}, {"issuedAt", issuedAt},
                        {"assets", {{"macos-arm64", {{"url", kUrl}, {"sha256", h.hex()}, {"size", size ? size : body.size()}}}}}}
      .dump();
}

struct Rig {
  TestKey key;
  FakePlatform fake;
  std::unique_ptr<Engine> engine;
  Rig() { fake.files[kUrl] = "archive"; }
  void boot() {
    fake.timers.clear();
    EngineConfig cfg;
    cfg.feedUrl = "https://example.org/stable.json";
    cfg.keys = {key.trusted()};
    engine = std::make_unique<Engine>(fake, cfg, nullptr);
    engine->start();
  }
  void serve(const std::string& m) { fake.feed = key.envelope(m); }
  nlohmann::json last() const { return engine->snapshot(); }
};

void testMalformedNeverThrows() {
  Rig r;
  r.fake.feed = R"({"format":"1","keyId":"test","manifest":"{}","signature":"AA=="})";
  r.boot();
  r.fake.runTimers();  // ne lève pas
  CHECK(r.engine->phase() == Phase::Idle);
  r.fake.feed = R"({"format":null})";
  r.engine->checkNow();
  CHECK(r.engine->phase() == Phase::Idle);
  // États locaux abîmés : valeurs par défaut, sans exception.
  writeFileAtomic(r.fake.dir + "/state.json", R"({"mutedThrough":3,"snoozedUntil":"x","badVersions":[1,"2.0.0"]})");
  writeFileAtomic(r.fake.dir + "/probation.json", R"({"version":["x"],"launches":"9","healthy":"oui"})");
  auto s = loadState(r.fake.dir + "/state.json");
  CHECK(s && s->mutedThrough.empty() && s->snoozedUntil == 0 && s->badVersions == std::vector<std::string>{"2.0.0"});
  auto p = loadProbation(r.fake.dir + "/probation.json");
  CHECK(p && p->version.empty() && p->launches == 0 && !p->healthy);
  r.boot();
}

void testCleanQuitIsNotAFailure() {
  Rig r;
  r.fake.version = "1.1.0";
  const std::string previous = r.fake.dir + "/.Tentacle.app.previous";
  std::filesystem::create_directories(previous);
  saveProbation(r.fake.dir + "/probation.json", {"1.1.0", previous, r.fake.dir});
  for (int i = 0; i < 4; ++i) {  // quatre ouvertures courtes, fermées proprement avant 10 s
    r.boot();
    r.engine->onQuit();
  }
  CHECK(r.fake.rollbacks.empty() && r.fake.quits == 0);
  CHECK(loadProbation(r.fake.dir + "/probation.json")->healthy);
  r.engine->markHealthy();  // le lancement suivant efface l'ancienne copie
  CHECK(r.fake.removed == std::vector<std::string>{previous});
}

void testNoRollbackWithoutPreviousCopy() {
  Rig r;
  r.fake.version = "1.1.0";
  saveProbation(r.fake.dir + "/probation.json", {"1.1.0", r.fake.dir + "/disparue", r.fake.dir});
  for (int i = 0; i < 5; ++i) r.boot();
  CHECK(r.fake.rollbacks.empty() && r.fake.quits == 0);  // jamais de boucle « quitter »
}

void testWithdrawnStagedIsDropped() {
  Rig r;
  r.serve(manifest("1.0.1", "minor", 100));
  r.boot();
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Ready);
  r.serve(manifest("1.0.0", "minor", 200));  // le serveur retire la 1.0.1
  r.engine->checkNow();
  CHECK(r.engine->phase() == Phase::Idle && r.fake.discarded.size() == 1);
  r.engine->onQuit();
  CHECK(r.fake.applied.empty());  // rien de retiré ne s'installe
}

void testAppliesTheStagedVersion() {
  Rig r;
  r.serve(manifest("1.0.1", "minor", 100));
  r.boot();
  r.fake.runTimers();
  r.fake.holdDownload = true;
  r.serve(manifest("1.0.2", "minor", 200));  // une plus récente arrive, encore en route
  r.engine->checkNow();
  r.engine->onQuit();
  CHECK(r.fake.applied.empty());  // la 1.0.1 a été abandonnée, la 1.0.2 n'est pas prête
}

void testRetriesWithoutVeilAndBackoff() {
  Rig r;
  r.serve(manifest("1.0.2", "critical"));
  r.fake.downloadNetworkError = true;
  r.boot();
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Failed && r.last()["prompt"] == "toast");
  const int64_t first = r.fake.timers.back().first;
  r.fake.runTimers();  // 2e échec : attente doublée
  CHECK(r.fake.timers.back().first == 2 * first);
  r.fake.downloadNetworkError = false;
  r.fake.holdDownload = true;
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Downloading && r.last()["prompt"] == "toast");  // pas de voile
  r.fake.finishDownload();
  CHECK(r.engine->phase() == Phase::Ready && r.last()["prompt"] == "blocking");     // prête : voile
}

void testSizeIsEnforced() {
  Rig r;
  r.serve(manifest("1.0.1", "minor", 100, "archive", 3));  // le manifeste annonce 3 octets
  r.boot();
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Failed && r.last()["error"] == "size");
}

void testCheckDoesNotHideReady() {
  Rig r;
  r.serve(manifest("1.1.0", "major"));
  r.boot();
  r.fake.runTimers();
  r.fake.holdFetch = true;
  r.engine->checkNow();  // contrôle en vol
  CHECK(r.engine->phase() == Phase::Ready && r.last()["prompt"] == "toast");
  CHECK(r.engine->restartNow().empty());
  r.fake.finishFetch();
  CHECK(r.fake.applied.size() == 1);
}

}  // namespace

void runReviewTests() {
  testMalformedNeverThrows();
  testCleanQuitIsNotAFailure();
  testNoRollbackWithoutPreviousCopy();
  testWithdrawnStagedIsDropped();
  testAppliesTheStagedVersion();
  testRetriesWithoutVeilAndBackoff();
  testSizeIsEnforced();
  testCheckDoesNotHideReady();
}
