// Portage de `backgroundDrain.test.ts`, `quitGuard.test.ts` et `closeSequence.test.ts` : une
// garde de sortie qui se trompe laisse une fenêtre qui refuse de se fermer ; une séquence de
// fermeture qui se trompe, une fenêtre cachée et une app vivante qu'aucun geste ne rattrape.

#include <functional>
#include <stdexcept>
#include <vector>

#include "lifecycle/background_drain.h"
#include "lifecycle/close_sequence.h"
#include "lifecycle/quit_guard.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;

namespace {

// ---- fin des transferts fenêtre fermée --------------------------------------------------
struct DrainHarness {
  int pending;
  bool busy;
  int64_t now = 0;
  int quits = 0, relaunches = 0, stops = 0, timers = 0;
  std::vector<int> announced;
  BackgroundDrain drain{DrainDeps{
      [this] { return pending; }, [this] { return busy; }, [this] { quits++; }, [this] { relaunches++; },
      [this] { stops++; }, [this](int n) { announced.push_back(n); }, [this] { return now; },
      [this](int64_t, std::function<void()>) -> std::function<void()> {
        timers++;
        return [this] { timers--; };
      }}};
  DrainHarness(int p, bool b) : pending(p), busy(b) {}
};

void drain() {
  CASE("la lecture s'arrête, l'application le dit, puis se ferme quand la file est vide");
  {
    DrainHarness h(12, true);
    h.drain.begin();
    CHECK(h.drain.active() && h.stops == 1);
    CHECK(h.announced == std::vector<int>{12});
    h.drain.check();
    CHECK(h.quits == 0);
    h.pending = 0;
    h.drain.check();
    CHECK(h.quits == 1 && !h.drain.active() && h.timers == 0);
  }
  CASE("plus rien ne bouge depuis dix minutes : elle se ferme, la file reprendra au lancement");
  {
    DrainHarness h(3, false);
    h.drain.begin();
    h.drain.check();
    h.now = kDrainIdleGiveUpMs - 1;
    h.drain.check();
    CHECK(h.quits == 0);
    h.now = kDrainIdleGiveUpMs;
    h.drain.check();
    CHECK(h.quits == 1);
  }
  CASE("un transfert qui repart remet l'attente à zéro");
  {
    DrainHarness h(3, false);
    h.drain.begin();
    h.drain.check();
    h.now = kDrainIdleGiveUpMs - 1;
    h.busy = true;
    h.drain.check();
    h.busy = false;
    h.now = kDrainIdleGiveUpMs + 1;
    h.drain.check();
    CHECK(h.quits == 0);
  }
  CASE("rouvrir pendant la fin des transferts relance, jamais une fenêtre dans le même processus");
  {
    DrainHarness h(3, true);
    CHECK(!h.drain.reopen());
    h.drain.begin();
    CHECK(h.drain.reopen());
    CHECK(h.relaunches == 1 && !h.drain.active());
  }
  CASE("deux fermetures n'ouvrent pas deux attentes");
  {
    DrainHarness h(3, true);
    h.drain.begin();
    h.drain.begin();
    CHECK(h.timers == 1 && h.announced.size() == 1);
  }
}

// ---- garde de sortie ----------------------------------------------------------------------
// Une boîte dont on décide la réponse, et le moment (comme les promesses du test d'Electron).
struct Box {
  bool response;
  int calls = 0;
  std::vector<std::function<void(bool)>> waiting;
  bool fails = false;
  ExitRequest ask() {
    return [this](int, std::function<void(bool)> answer) {
      calls++;
      if (fails) throw std::runtime_error("pas d'affichage");
      waiting.push_back(std::move(answer));
    };
  }
  void settle() {
    auto all = std::move(waiting);
    for (auto& a : all) a(response);
  }
};

void guard() {
  int closes = 0;
  CASE("laisse fermer quand rien ne télécharge");
  {
    Box box{false};
    QuitGuard g([] { return 0; }, box.ask());
    CHECK(!g.onClose({}) && box.calls == 0);
  }
  CASE("retient la fermeture et demande, quand un transfert tourne");
  {
    Box box{false};
    QuitGuard g([] { return 1; }, box.ask());
    CHECK(g.onClose({}) && box.calls == 1);
  }
  CASE("« Continuer en arrière-plan » : la fenêtre se ferme sans question");
  {
    Box box{false};
    QuitGuard g([] { return 3; }, box.ask(), [] { return true; });
    CHECK(!g.onClose({}) && box.calls == 0);
  }
  CASE("réglage éteint, ou quitter pour de bon (Cmd+Q) : la question, comme avant");
  {
    Box box{false};
    QuitGuard g([] { return 3; }, box.ask(), [] { return false; });
    CHECK(g.onClose({}) && box.calls == 1);
  }
  CASE("un réglage illisible ne retient rien de plus : la question");
  {
    Box box{false};
    QuitGuard g([] { return 3; }, box.ask(), []() -> bool { throw std::runtime_error("base"); });
    CHECK(g.onClose({}) && box.calls == 1);
  }
  CASE("ferme pour de bon après l'accord");
  {
    Box box{true};
    closes = 0;
    QuitGuard g([] { return 1; }, box.ask());
    std::function<void()> again = [&] {
      closes++;
      g.onClose(again);  // le close() qui suit repasse par la garde
    };
    g.onClose(again);
    box.settle();
    CHECK(closes == 1 && box.calls == 1);
  }
  CASE("laisse la fenêtre ouverte quand on annule ; redemande à la fermeture suivante");
  {
    Box box{false};
    closes = 0;
    QuitGuard g([] { return 2; }, box.ask());
    g.onClose([&] { closes++; });
    box.settle();
    CHECK(closes == 0);
    g.onClose([&] { closes++; });
    CHECK(box.calls == 2);
  }
  CASE("n'ouvre qu'une boîte pour deux fermetures rapprochées");
  {
    Box box{false};
    QuitGuard g([] { return 1; }, box.ask());
    CHECK(g.onClose({}) && g.onClose({}));
    CHECK(box.calls == 1);
  }
  CASE("quitte si la boîte échoue");
  {
    Box box{false};
    box.fails = true;
    closes = 0;
    QuitGuard g([] { return 1; }, box.ask());
    g.onClose([&] { closes++; });
    CHECK(closes == 1);
  }
  CASE("laisse fermer si le comptage échoue");
  {
    Box box{false};
    QuitGuard g([]() -> int { throw std::runtime_error("base indisponible"); }, box.ask());
    CHECK(!g.onClose({}) && box.calls == 0);
  }
}

// ---- séquence de fermeture ----------------------------------------------------------------
struct SeqHarness {
  int hides = 0, destroys = 0, stopCalls = 0;
  std::function<void()> release;
  std::vector<std::function<void()>> timers;
  bool running = true;
  bool throwsRunning = false;
  CloseSequence seq{
      ClosingWindow{[this] { hides++; }, [this] { destroys++; }, [this] { return destroys > 0; }},
      [this] {
        if (throwsRunning) throw std::runtime_error("poignée perdue");
        return running;
      },
      [this](std::function<void()> done) {
        stopCalls++;
        release = std::move(done);
      },
      [this](int64_t, std::function<void()> fn) { timers.push_back(std::move(fn)); }};
};

void sequence() {
  CASE("laisse passer la fermeture quand aucun lecteur ne tourne");
  {
    SeqHarness h;
    h.running = false;
    CHECK(!h.seq.onClose(false) && h.stopCalls == 0 && h.hides == 0);
  }
  CASE("cache la fenêtre TOUT DE SUITE, puis détruit quand mpv a rendu la main");
  {
    SeqHarness h;
    CHECK(h.seq.onClose(false));
    CHECK(h.hides == 1 && h.stopCalls == 1 && h.destroys == 0);
    h.release();
    CHECK(h.destroys == 1);
  }
  CASE("ne fait rien quand la garde de sortie a déjà retenu la fermeture");
  {
    SeqHarness h;
    h.seq.onClose(true);
    CHECK(h.stopCalls == 0 && h.hides == 0);
  }
  CASE("détruit quand même la fenêtre si mpv ne rend jamais la main");
  {
    SeqHarness h;
    h.seq.onClose(false);
    for (auto& t : h.timers) t();
    CHECK(h.destroys == 1);
    h.release();  // l'arrêt qui aboutit après coup ne détruit pas une seconde fois
    CHECK(h.destroys == 1);
  }
  CASE("laisse la seconde fermeture passer pendant le démontage");
  {
    SeqHarness h;
    h.seq.onClose(false);
    CHECK(!h.seq.onClose(false) && h.stopCalls == 1);
  }
  CASE("ne retient pas la fermeture si l'état du lecteur est illisible");
  {
    SeqHarness h;
    h.throwsRunning = true;
    CHECK(!h.seq.onClose(false) && h.hides == 0);
  }
}

}  // namespace

void runExitRulesTests() {
  drain();
  guard();
  sequence();
}
