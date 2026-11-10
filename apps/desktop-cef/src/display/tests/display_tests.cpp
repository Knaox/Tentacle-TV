// La règle du module écran, sans OS ni lecteur : session HDR (hdrSession.ts d'Electron) et
// verdict du Microsoft Store (msixInstallState.test.ts, cas repris un à un). Sans dépendance
// de test, comme ceux du pont : un échec imprime sa ligne, le code de sortie compte les échecs.
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "hdr_session.h"
#include "msix_rule.h"

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

}  // namespace

int main() {
  hdrSession();
  msixRule();
  if (failures == 0) std::printf("display : tous les tests passent\n");
  return failures;
}
