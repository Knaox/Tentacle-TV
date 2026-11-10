// Le déroulé complet de la fermeture (`index.ts` d'Electron : close → closed →
// window-all-closed → will-quit), sur des ports en mémoire.

#include <functional>
#include <string>
#include <vector>

#include "lifecycle/exit_flow.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;
using Phase = ExitFlow::Phase;

namespace {

struct Harness {
  int inFlight = 0;
  bool busy = false, background = true, video = false;
  std::vector<std::string> trace;
  std::vector<std::function<void()>> later;      // `after`
  std::function<void(bool)> boxAnswer;          // la boîte ouverte
  std::function<void()> farewellDone, videoDone;
  std::function<void()> tick;
  int64_t now = 0;
  ExitFlow flow{ExitPorts{
      [this] { trace.push_back("hide"); },
      [this] { trace.push_back("closeBrowser"); },
      [this] { trace.push_back("focus"); },
      [this] { return video; },
      [this](std::function<void()> done) {
        trace.push_back("stopVideo");
        videoDone = std::move(done);
      },
      [this] { trace.push_back("pauseVideo"); },
      [this] { return inFlight; },
      [this] { return busy; },
      [this] { return background; },
      [this](int n, std::function<void(bool)> answer) {
        trace.push_back("ask:" + std::to_string(n));
        boxAnswer = std::move(answer);
      },
      [this](int n) { trace.push_back("announce:" + std::to_string(n)); },
      [this] { trace.push_back("closed"); },
      [this](std::function<void()> done) {
        trace.push_back("farewell");
        farewellDone = std::move(done);
      },
      [this] { trace.push_back("spawn"); },
      [this] { trace.push_back("finish"); },
      [this] { return now; },
      [this](int64_t, std::function<void()> fn) { later.push_back(std::move(fn)); },
      [this](int64_t, std::function<void()> t) -> std::function<void()> {
        tick = std::move(t);
        return [this] { tick = nullptr; };
      }}};
  void runLater() {
    auto all = std::move(later);
    for (auto& fn : all) fn();
  }
  bool has(const std::string& s) const {
    for (const auto& t : trace) if (t == s) return true;
    return false;
  }
};

void flows() {
  CASE("fermer sans rien en cours : la fenêtre part, l'adieu, puis la sortie");
  {
    Harness h;
    h.flow.requestClose();
    CHECK((h.trace == std::vector<std::string>{"hide", "closeBrowser"}));
    h.flow.browserClosed();
    CHECK(h.has("closed") && h.has("farewell") && !h.has("finish"));
    h.farewellDone();
    CHECK(h.has("finish") && h.flow.phase() == Phase::Done);
  }
  CASE("fermer pendant un transfert, réglage allumé : sans question, les transferts finissent sans fenêtre");
  {
    Harness h;
    h.inFlight = 2;
    h.busy = true;
    h.flow.requestClose();
    CHECK(!h.has("ask:2") && h.has("closeBrowser"));
    h.flow.browserClosed();
    CHECK(h.flow.phase() == Phase::Draining && h.has("announce:2") && !h.has("farewell"));
    h.inFlight = 0;
    h.tick();
    CHECK(h.has("farewell"));
    h.farewellDone();
    CHECK(h.has("finish"));
  }
  CASE("quitter (Cmd+Q) pendant un transfert : la question ; « Annuler » garde tout ouvert");
  {
    Harness h;
    h.inFlight = 1;
    h.flow.requestQuit();
    CHECK(h.has("ask:1") && !h.has("closeBrowser"));
    h.boxAnswer(false);
    h.runLater();
    CHECK(!h.has("closeBrowser") && h.flow.phase() == Phase::Running);
    // Puis la croix : le réglage reprend la main, pas de question.
    h.trace.clear();
    h.flow.requestClose();
    CHECK(!h.has("ask:1") && h.has("closeBrowser"));
  }
  CASE("« Quitter quand même » : la fenêtre part et l'app quitte, transferts ou pas");
  {
    Harness h;
    h.inFlight = 3;
    h.flow.requestQuit();
    h.boxAnswer(true);
    CHECK(!h.has("closeBrowser"));  // jamais en ligne : au tour suivant
    h.runLater();
    CHECK(h.has("closeBrowser"));
    h.flow.browserClosed();
    CHECK(h.flow.phase() == Phase::Quitting && h.has("farewell"));
  }
  CASE("réglage éteint : fermer pose la question comme quitter");
  {
    Harness h;
    h.inFlight = 1;
    h.background = false;
    h.flow.requestClose();
    CHECK(h.has("ask:1"));
  }
  CASE("deux fermetures pendant la question : une seule boîte");
  {
    Harness h;
    h.inFlight = 1;
    h.flow.requestQuit();
    h.flow.requestQuit();
    h.flow.requestClose();
    int asks = 0;
    for (const auto& t : h.trace) asks += t == "ask:1";
    CHECK(asks == 1);
  }
  CASE("vidéo en cours : fenêtre cachée tout de suite, lecteur arrêté, puis la page part");
  {
    Harness h;
    h.video = true;
    h.flow.requestClose();
    CHECK((h.trace == std::vector<std::string>{"hide", "stopVideo"}));
    h.videoDone();
    CHECK(h.has("closeBrowser"));
  }
  CASE("vidéo jamais rendue : la page part à l'échéance");
  {
    Harness h;
    h.video = true;
    h.flow.requestClose();
    h.runLater();
    CHECK(h.has("closeBrowser"));
  }
  CASE("rouvrir pendant la fin des transferts relance l'app ; fenêtre ouverte, la ramène devant");
  {
    Harness h;
    CHECK(h.flow.reopen() && h.has("focus"));
    h.inFlight = 1;
    h.flow.requestClose();
    h.flow.browserClosed();
    CHECK(h.flow.reopen());
    CHECK(h.has("spawn") && h.has("farewell"));
  }
  CASE("Cmd+Q pendant la fin des transferts : quitter, sans question");
  {
    Harness h;
    h.inFlight = 1;
    h.flow.requestClose();
    h.flow.browserClosed();
    h.flow.requestQuit();
    CHECK(!h.has("ask:1") && h.has("farewell"));
  }
  CASE("relancer : une nouvelle instance, ni question, ni adieu, ni transferts sans fenêtre");
  {
    Harness h;
    h.inFlight = 4;
    h.flow.requestRelaunch();
    CHECK(h.has("spawn") && h.has("closeBrowser") && !h.has("ask:4"));
    h.flow.browserClosed();
    CHECK(h.has("finish") && !h.has("farewell") && !h.has("announce:4"));
  }
  CASE("l'adieu met la vidéo en pause pendant qu'on poste");
  {
    Harness h;
    h.flow.requestClose();
    h.video = true;  // une vidéo encore là au moment de quitter
    h.flow.browserClosed();
    CHECK(h.has("pauseVideo") && h.has("farewell"));
  }
}

}  // namespace

void runExitFlowTests() { flows(); }
