// La règle du module écran, sans OS ni lecteur : session HDR (hdrSession.ts d'Electron), relevé
// de la sortie de mpv sous Linux (linux/hdr.ts) et verdict du Microsoft Store (msixInstallState.test.ts, cas repris un à un). Sans dépendance
// de test, comme ceux du pont : un échec imprime sa ligne, le code de sortie compte les échecs.
#include <cmath>
#include <cstdio>
#include <functional>
#include <map>
#include <string>
#include <vector>

#include "hdr_session.h"
#include "msix_rule.h"
#include "output_reading.h"

using namespace tentacle;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

namespace {

// Un écran et un lecteur factices ; `trace` garde l'ordre des gestes.
struct Bench {
  bool negotiated = true, hdr = false, canEnable = true;
  std::string gamma = "pq";
  std::vector<std::string> trace;

  display::DisplayOps ops() {
    return {[this] { return negotiated; }, [this] { return hdr; },
            [this] {
              trace.push_back("enable");
              if (canEnable) hdr = true;
              return hdr;
            },
            [this] { trace.push_back("restore"); }};
  }
  pont::VideoSessionAccess player() {
    pont::VideoSessionAccess a;
    a.get = [this](const std::string& name, std::function<void(std::optional<bridge::Json>)> cb) {
      cb(name == "video-params/gamma" ? std::optional<bridge::Json>(gamma) : std::nullopt);
    };
    a.set = [this](const std::string& name, const bridge::Json& v) { trace.push_back(name + "=" + v.get<std::string>()); };
    return a;
  }
};

void quiet(const std::string&) {}

void hdrSession() {
  {  // macOS, Linux : rien à négocier, jamais un geste (ni bascule, ni drapeau)
    Bench b;
    b.negotiated = false;
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    s.onVideoStopped();
    CHECK(b.trace == std::vector<std::string>{"restore"});  // restore : sans effet hors Windows
  }
  {  // écran SDR, bascule non autorisée : tone-mapping, rien ne bouge
    Bench b;
    display::HdrSession s(b.ops(), quiet);
    s.onVideoEvent("video-reconfig", b.player());
    CHECK(b.trace.empty());
  }
  {  // écran SDR, bascule autorisée : bascule PUIS transmission
    Bench b;
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    CHECK((b.trace == std::vector<std::string>{"enable", "target-colorspace-hint=yes"}));
  }
  {  // écran déjà en HDR : transmission seule, même sans la préférence, jamais de bascule
    Bench b;
    b.hdr = true;
    display::HdrSession s(b.ops(), quiet);
    s.onVideoEvent("file-loaded", b.player());
    CHECK((b.trace == std::vector<std::string>{"target-colorspace-hint=yes"}));
  }
  {  // contenu SDR : rien à transmettre
    Bench b;
    b.gamma = "bt.1886";
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    CHECK(b.trace.empty());
  }
  {  // bascule refusée par Windows : pas de transmission (sinon image quasi noire)
    Bench b;
    b.canEnable = false;
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    CHECK((b.trace == std::vector<std::string>{"enable"}));
  }
  {  // fin : la transmission tombe AVANT que l'écran soit rendu
    Bench b;
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    b.trace.clear();
    s.onVideoStopped();
    CHECK((b.trace == std::vector<std::string>{"target-colorspace-hint=no", "restore"}));
  }
  {  // la page décoche en pleine lecture : effet immédiat
    Bench b;
    display::HdrSession s(b.ops(), quiet);
    s.allowToggle(true);
    s.onVideoEvent("video-reconfig", b.player());
    b.trace.clear();
    s.allowToggle(false);
    CHECK(!s.toggleAllowed());
    CHECK((b.trace == std::vector<std::string>{"target-colorspace-hint=no", "restore"}));
  }
  {  // autres évènements ignorés
    Bench b;
    b.hdr = true;
    display::HdrSession s(b.ops(), quiet);
    s.onVideoEvent("playback-restart", b.player());
    CHECK(b.trace.empty());
  }
}

void msixRule() {
  using display::msixInstallError;
  using display::opensStorePage;
  CHECK(!msixInstallError(3));  // Completed (3) est le seul succès
  CHECK(msixInstallError(0) == "install-state-0");  // Pending n'est pas un succès
  CHECK(msixInstallError(1) == "install-state-1");
  CHECK(msixInstallError(2) == "install-state-2");
  CHECK(msixInstallError(5) == "install-state-5");
  CHECK(msixInstallError(std::nullopt) == "install-state-null");
  CHECK(msixInstallError(42) == "install-state-42");
  CHECK(msixInstallError(4) == "install-canceled");
  CHECK(msixInstallError(6) == "install-low-battery");
  CHECK(msixInstallError(7) == "install-wifi-required");
  CHECK(msixInstallError(8) == "install-wifi-required");
  CHECK(!opensStorePage("install-canceled"));
  CHECK(!opensStorePage("install-low-battery"));
  CHECK(!opensStorePage("install-wifi-required"));
  CHECK(opensStorePage("install-state-5"));
  CHECK(opensStorePage("install-failed"));
  CHECK(opensStorePage("store-unavailable"));
}

// Un lecteur dont les propriétés sont une table (absente : mpv ne dit rien).
pont::VideoSessionAccess props(std::map<std::string, bridge::Json>& table) {
  pont::VideoSessionAccess a;
  a.get = [&table](const std::string& name, std::function<void(std::optional<bridge::Json>)> cb) {
    auto it = table.find(name);
    cb(it == table.end() ? std::nullopt : std::optional<bridge::Json>(it->second));
  };
  a.set = [](const std::string&, const bridge::Json&) {};
  return a;
}

void outputReading() {
  using display::OutputReading;
  // La forme du panneau F9 (linux/hdr.ts › describeReading), verdict compris.
  CHECK(display::describeReading({"pq", "pq", "bt.2020", 3.813229}) == "contenu pq → sortie pq/bt.2020 · pic 3.81×");
  CHECK(display::describeReading({"pq", "bt.1886", "bt.709", std::nullopt}) == "contenu pq → sortie bt.1886/bt.709 — TONE-MAPPÉ");
  CHECK(display::describeReading({"bt.1886", "pq", "bt.2020", std::nullopt}) == "contenu bt.1886 → sortie pq/bt.2020 — SDR converti");
  // Contenu inconnu : comme Electron (isHdr(null) faux), une sortie HDR se dit « SDR converti ».
  CHECK(display::describeReading({std::nullopt, "hlg", std::nullopt, std::nullopt}) == "contenu ? → sortie hlg/? — SDR converti");
  // Rien relevé : null, jamais « non ». Film SDR : la transmission ne se pose pas.
  CHECK(!display::outputHdr(std::nullopt) && !display::hdrTransmission(std::nullopt));
  CHECK(display::outputHdr(OutputReading{"bt.1886", "pq", {}, {}}) == true);  // écran laissé en HDR
  CHECK(!display::hdrTransmission(OutputReading{"bt.1886", "pq", {}, {}}));
  CHECK(display::hdrTransmission(OutputReading{"pq", "pq", {}, {}}) == true);
  CHECK(display::hdrTransmission(OutputReading{"hlg", "bt.1886", {}, {}}) == false);  // aplati : la seule alerte

  std::vector<std::string> log;
  display::OutputReader reader([&log](const std::string& l) { log.push_back(l); });
  std::map<std::string, bridge::Json> table{{"video-params/gamma", "pq"}};
  // À file-loaded, la sortie n'existe pas encore : rien de relevé, rien de journalisé.
  reader.onVideoEvent("file-loaded", props(table));
  CHECK(!reader.last() && log.empty());
  table["video-target-params/gamma"] = "";
  reader.onVideoEvent("video-reconfig", props(table));
  CHECK(!reader.last());
  // Puis la sortie : le pic arrive en texte ou en nombre.
  table["video-target-params/gamma"] = "pq";
  table["video-target-params/primaries"] = "bt.2020";
  table["video-target-params/sig-peak"] = "3.813229";
  reader.onVideoEvent("video-reconfig", props(table));
  CHECK(reader.last() && reader.last()->peak && std::abs(*reader.last()->peak - 3.813229) < 1e-6);
  CHECK(log.size() == 1 && log[0] == "contenu pq → sortie pq/bt.2020 · pic 3.81×");
  table["video-target-params/sig-peak"] = 2.5;
  reader.onVideoEvent("video-reconfig", props(table));
  CHECK(reader.last()->peak == 2.5 && log.size() == 1);  // même couple : une ligne, pas deux
  reader.onVideoEvent("playback-restart", props(table));  // autre évènement : ignoré
  // Arrêt : le relevé s'oublie (ne décrit jamais une lecture finie).
  reader.onVideoStopped();
  CHECK(!reader.last());
  // Une réponse arrivée APRÈS l'arrêt est ignorée.
  std::function<void(std::optional<bridge::Json>)> late;
  pont::VideoSessionAccess slow;
  slow.get = [&late](const std::string&, std::function<void(std::optional<bridge::Json>)> cb) { late = std::move(cb); };
  slow.set = [](const std::string&, const bridge::Json&) {};
  reader.onVideoEvent("video-reconfig", slow);
  reader.onVideoStopped();
  late(bridge::Json("pq"));
  CHECK(!reader.last());
}

}  // namespace

int main() {
  hdrSession();
  msixRule();
  outputReading();
  if (failures == 0) std::printf("display : tous les tests passent\n");
  return failures;
}
