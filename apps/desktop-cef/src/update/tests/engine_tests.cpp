// Le moteur sur un faux système : les trois parcours (mineure, majeure, critique), hors
// ligne, empreinte fausse, manifeste rejoué, période d'essai et retour arrière.
#include <filesystem>
#include <string>

#include "tests/check.h"
#include "tests/fake_platform.h"
#include "update/engine.h"

using namespace tentacle::update;
using namespace tentacle::update::testing;

namespace {

const std::string kUrl = "https://example.org/Tentacle-2.0.0.tar.xz";
const std::string kArchive = "archive-bytes";

std::string manifest(const char* version, const char* severity, int64_t issuedAt = 100,
                     const std::string& body = kArchive) {
  Sha256 h;
  h.update(body.data(), body.size());
  return nlohmann::json{{"version", version}, {"channel", "stable"}, {"severity", severity},
                        {"issuedAt", issuedAt}, {"notes", {{"fr", "• Nouveau"}, {"en", "• New"}}},
                        {"assets", {{"macos-arm64", {{"url", kUrl}, {"sha256", h.hex()}, {"size", body.size()}}}}}}
      .dump();
}

struct Rig {
  TestKey key;
  FakePlatform fake;
  std::vector<nlohmann::json> events;
  std::unique_ptr<Engine> engine;
  Rig() { fake.files[kUrl] = kArchive; }
  void boot() {
    fake.timers.clear();  // les minuteries du moteur précédent meurent avec lui
    EngineConfig cfg;
    cfg.feedUrl = "https://example.org/stable.json";
    cfg.keys = {key.trusted()};
    engine = std::make_unique<Engine>(fake, cfg, [this](const nlohmann::json& s) { events.push_back(s); });
    engine->start();
  }
  void serve(const std::string& m) { fake.feed = key.envelope(m); }
  nlohmann::json last() const { return engine->snapshot(); }
  bool anyPrompt(const char* prompt) const {
    for (auto& e : events)
      if (e["prompt"] == prompt) return true;
    return false;
  }
};

void testMinorIsSilent() {
  Rig r;
  r.serve(manifest("1.0.1", "minor"));
  r.boot();
  CHECK(r.fake.fetches == 0 && r.fake.timers.size() == 1);  // premier contrôle différé
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Ready);
  CHECK(!r.anyPrompt("toast") && !r.anyPrompt("blocking"));  // AUCUNE notification
  CHECK(r.fake.applied.empty());
  r.engine->onQuit();  // posée en silence, effective au prochain lancement
  CHECK(r.fake.applied.size() == 1 && r.fake.applied[0].find("|1.0.1|quit") != std::string::npos);
  r.engine->onQuit();
  CHECK(r.fake.applied.size() == 1);
}

void testMajorNotifiesOnceAndMutes() {
  Rig r;
  r.serve(manifest("1.1.0", "major"));
  r.boot();
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Ready && r.last()["prompt"] == "toast" && r.last()["canMute"] == true);
  CHECK(r.last()["update"]["notes"]["fr"] == "• Nouveau");
  // « Plus tard » : silence, rappel après 24 h.
  r.engine->later();
  CHECK(r.last()["prompt"] == "none");
  r.fake.clock += 24 * 3600;
  r.engine->checkNow();
  CHECK(r.last()["prompt"] == "toast");
  // « Ne plus m'avertir… » : retenu par l'appareil, même après un redémarrage.
  r.engine->muteUntilNextMajor();
  CHECK(r.last()["prompt"] == "none" && r.engine->phase() == Phase::Ready);
  Rig again;
  again.fake.dir.swap(r.fake.dir);  // même appareil
  again.serve(manifest("1.1.0", "major"));
  again.boot();
  again.fake.runTimers();
  CHECK(again.last()["prompt"] == "none");
  CHECK(again.engine->state().mutedThrough == "1.1.0");
  // La majeure suivante lève le silence.
  again.fake.version = "1.1.0";
  again.serve(manifest("1.2.0", "major", 200));
  again.boot();
  again.fake.runTimers();
  CHECK(again.last()["prompt"] == "toast");
  // Redémarrer pour mettre à jour : assistant lancé AVEC relance, puis l'app quitte.
  CHECK(again.engine->restartNow().empty());
  CHECK(again.fake.applied.back().find("|1.2.0|relaunch") != std::string::npos && again.fake.quits == 1);
  again.engine->onQuit();
  CHECK(again.fake.applied.size() == 1);  // pas deux fois
  r.fake.dir.swap(again.fake.dir);
}

void testCriticalBlocksButNotOffline() {
  Rig r;
  r.serve(manifest("1.0.2", "critical"));
  r.fake.holdDownload = true;
  r.boot();
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Downloading && r.last()["prompt"] == "blocking");
  CHECK(r.last()["update"]["mandatory"] == true && r.last()["canMute"] == false);
  r.engine->later();
  r.engine->muteUntilNextMajor();
  CHECK(r.last()["prompt"] == "blocking");  // non masquable
  // Le réseau tombe pendant le téléchargement : avertir, ne PAS bloquer.
  r.fake.downloadNetworkError = true;
  r.fake.finishDownload();
  CHECK(r.engine->phase() == Phase::Failed && r.last()["prompt"] == "toast" && r.last()["error"] == "network");
  // Le réseau revient : nouvel essai programmé, puis prête et bloquante.
  r.fake.downloadNetworkError = false;
  r.fake.runTimers();
  CHECK(r.engine->phase() == Phase::Ready && r.last()["prompt"] == "blocking");
  CHECK(r.engine->restartNow().empty() && r.fake.quits == 1);

  // Lancé hors ligne : aucune décision, aucun blocage.
  Rig off;
  off.boot();
  off.fake.runTimers();
  CHECK(off.engine->phase() == Phase::Idle && off.last()["prompt"] == "none" && off.events.empty());
}

void testRefusals() {
  {  // Empreinte fausse : archive effacée, échec, nouvel essai.
    Rig r;
    r.serve(manifest("1.0.1", "minor", 100, "autre contenu"));
    r.boot();
    r.fake.runTimers();
    CHECK(r.engine->phase() == Phase::Failed && r.last()["error"] == "checksum" && r.last()["prompt"] == "none");
    CHECK(!r.fake.timers.empty());
  }
  {  // Signature d'une autre clé : ignoré.
    Rig r;
    TestKey intruder;
    r.fake.feed = intruder.envelope(manifest("9.0.0", "critical"));
    r.boot();
    r.fake.runTimers();
    CHECK(r.engine->phase() == Phase::Idle && r.events.empty());
  }
  {  // Un manifeste plus ancien rejoué après un plus récent : refusé.
    Rig r;
    r.serve(manifest("1.0.1", "minor", 500));
    r.boot();
    r.fake.runTimers();
    CHECK(r.engine->state().lastIssuedAt == 500);
    r.serve(manifest("1.0.2", "critical", 400));
    r.engine->checkNow();
    CHECK(r.last()["update"]["version"] == "1.0.1");
  }
  {  // Dossier de l'app non inscriptible : une critique prévient sans bloquer.
    Rig r;
    r.fake.writable = false;
    r.serve(manifest("1.0.2", "critical"));
    r.boot();
    r.fake.runTimers();
    CHECK(r.engine->phase() == Phase::Failed && r.last()["prompt"] == "toast");
    CHECK(r.last()["error"] == "cannot-install:read-only");
  }
  {  // Archive incohérente (mauvais paquet) : refusée à la préparation.
    Rig r;
    r.fake.stageError = "bundle-id";
    r.serve(manifest("1.0.1", "minor"));
    r.boot();
    r.fake.runTimers();
    CHECK(r.engine->phase() == Phase::Failed && r.last()["error"] == "stage:bundle-id");
  }
}

void testProbation() {
  Rig r;
  r.fake.version = "1.1.0";
  const std::string app = r.fake.dir + "/Tentacle.app", previous = r.fake.dir + "/.Tentacle.app.previous";
  std::filesystem::create_directories(app);
  std::filesystem::create_directories(previous);
  saveProbation(r.fake.dir + "/probation.json", {"1.1.0", previous, app});
  r.boot();  // 1er lancement de la nouvelle version
  r.boot();  // 2e
  CHECK(r.fake.rollbacks.empty());
  r.boot();  // 3e sans « bonne santé » : retour arrière
  CHECK(r.fake.rollbacks.size() == 1 && r.fake.quits == 1);
  r.engine->onQuit();  // on quitte POUR revenir en arrière : pas une preuve de bonne santé
  CHECK(!loadProbation(r.fake.dir + "/probation.json")->healthy);

  // Retour arrière immédiat (Linux) : le moteur ne doit pas écraser ce que la plateforme a noté.
  Rig now;
  now.fake.version = "1.1.0";
  now.fake.syncRollback = true;
  std::filesystem::create_directories(now.fake.dir + "/Tentacle.app");
  std::filesystem::create_directories(now.fake.dir + "/.Tentacle.app.previous");
  saveProbation(now.fake.dir + "/probation.json",
                {"1.1.0", now.fake.dir + "/.Tentacle.app.previous", now.fake.dir + "/Tentacle.app"});
  now.boot();
  now.boot();
  now.boot();
  CHECK(now.fake.rollbacks.size() == 1 && loadProbation(now.fake.dir + "/probation.json")->rolledBack == "1.1.0");
  now.fake.version = "1.0.0";  // l'ancienne version relancée s'en souvient
  now.boot();
  CHECK(now.engine->state().badVersions == std::vector<std::string>{"1.1.0"});

  Rig ok;
  ok.fake.version = "1.1.0";
  const std::string okPrevious = ok.fake.dir + "/.Tentacle.app.previous";
  std::filesystem::create_directories(okPrevious);
  saveProbation(ok.fake.dir + "/probation.json", {"1.1.0", okPrevious, ok.fake.dir});
  ok.boot();
  ok.engine->markHealthy();
  CHECK(ok.fake.removed == std::vector<std::string>{okPrevious});
  ok.boot();
  ok.boot();
  ok.boot();
  CHECK(ok.fake.rollbacks.empty());

  // L'assistant est revenu en arrière : la version est retenue comme mauvaise.
  Rig back;
  Probation p{"1.1.0", "", "/Apps/Tentacle.app"};
  p.rolledBack = "1.1.0";
  saveProbation(back.fake.dir + "/probation.json", p);
  back.serve(manifest("1.1.0", "major"));
  back.boot();
  CHECK(back.last()["rolledBack"] == "1.1.0");
  back.fake.runTimers();
  CHECK(back.engine->phase() == Phase::Idle && back.last()["prompt"] == "none");
  CHECK(back.engine->state().badVersions == std::vector<std::string>{"1.1.0"});
  back.engine->markHealthy();
  CHECK(back.last()["rolledBack"] == "1.1.0");  // l'annonce reste jusqu'à ce qu'on la ferme
  back.engine->dismissNotice();
  CHECK(back.last()["rolledBack"] == "");
}

}  // namespace

void runEngineTests() {
  testMinorIsSilent();
  testMajorNotifiesOnceAndMutes();
  testCriticalBlocksButNotOffline();
  testRefusals();
  testProbation();
}
