// Le contrôleur (`pipWindow.ts`, `ipc/pip.ts`, `pipQuit.ts`) : ouverture armée, vidéo prêtée
// puis rendue, fermetures — dans l'ordre qui garde la vidéo vivante.
#include "pip/tests/check.h"
#include "pip/tests/fakes.h"

using namespace pip_tests;

namespace {

struct Fixture {
  FakePlatform platform;
  FakeCompositor mainStack;
  Controller controller{platform, &mainStack, nullptr, frameFor(Os::macos)};
  int closes = 0;

  /// La page réduit : `pip_open`, puis `window.open`, puis le navigateur naît.
  void open(Mode mode = Mode::floating) {
    controller.arm(mode, 480, 270);
    CHECK(controller.decide("tentacle-pip", "about:blank").kind == OpenDecision::Kind::allow);
    controller.popupCreated(std::make_unique<FakePage>(&closes), PageInput{});
  }
};

void withoutPip() {
  Fixture f;
  // Sans PiP, les commandes répondent « rien à faire », comme Electron.
  CHECK(!f.controller.setMode(Mode::docked, std::nullopt));
  CHECK(!f.controller.resize(640, 360));
  CHECK(!f.controller.setGesture(Gesture::move, std::nullopt));
  CHECK(!f.controller.close());
  bool restored = true;
  f.controller.restore([&](bool v) { restored = v; });
  CHECK(!restored);
  // pip_open rend le cadre de macOS.
  const Frame frame = f.controller.arm(Mode::floating, 480, 270);
  CHECK(frame.shadow == 4 && frame.bezel == 4);
  // Avant la naissance du navigateur, la vue a la taille annoncée.
  CHECK(f.controller.decide("tentacle-pip", "about:blank").kind == OpenDecision::Kind::allow);
  CHECK(f.controller.viewSize() == (Size{496, 286}));
  // Une seconde fenêtre PiP n'est jamais acceptée tant qu'une est en route.
  f.controller.arm(Mode::floating, 480, 270);
  CHECK(f.controller.decide("tentacle-pip", "about:blank").kind == OpenDecision::Kind::deny);
}

void openLendsVideo() {
  journal.clear();
  Fixture f;
  f.open();
  FakeWindow* w = f.platform.last;
  CHECK(w != nullptr);
  CHECK(w->shown);
  CHECK(w->captionText == "Tentacle TV · Picture-in-Picture");
  // La vidéo passe dans la pile du PiP, à `inset` de ses bords, AVANT que la fenêtre paraisse.
  CHECK(f.mainStack.borrower == &w->stack);
  CHECK(w->stack.inset == 8);
  CHECK((journal == std::vector<std::string>{"lend", "show"}));
  CHECK(f.controller.popupAlive());
  // Le mode change le titre (que la colle lit sous Linux) et la plateforme le suit.
  CHECK(f.controller.setMode(Mode::docked, std::nullopt));
  CHECK(w->captionText == "Tentacle TV · Mini player");
  CHECK(w->modes.back() == Mode::docked);
}

void closeByPage() {
  journal.clear();
  Fixture f;
  f.open();
  f.platform.last->hasFocus = true;
  journal.clear();
  // pip_close : la vidéo revient d'abord, la fenêtre se cache, le focus revient, puis le
  // navigateur part.
  CHECK(f.controller.close());
  CHECK((journal == std::vector<std::string>{"reclaim", "hide", "focus host", "page close"}));
  CHECK(f.controller.close());  // déjà en route : rien de plus
  CHECK(f.closes == 1);
  f.controller.popupClosing();  // DoClose du navigateur : déjà fait
  f.controller.popupClosed();   // OnBeforeClose : la fenêtre part avec lui
  CHECK(journal.back() == "window destroyed");
  CHECK(!f.controller.popupAlive());
  CHECK(f.mainStack.borrower == nullptr);
}

void closedFromInside() {
  // `window.close()` de la page (filet de PipWindow.tsx) : DoClose, puis OnBeforeClose.
  journal.clear();
  Fixture f;
  f.open();
  journal.clear();
  f.controller.popupClosing();
  CHECK((journal == std::vector<std::string>{"reclaim", "hide"}));
  f.controller.popupClosed();
  CHECK(f.closes == 0);
  // Un nouveau PiP peut naître ensuite.
  f.open();
  CHECK(f.controller.popupAlive());
}

void quitWithPip() {
  // Quitter pendant le PiP : le PiP part AVANT la fenêtre principale, la vidéo revient à
  // une page encore vivante (`pipQuit.test.ts`).
  journal.clear();
  Fixture f;
  f.open();
  journal.clear();
  f.controller.hostClosing();
  CHECK(journal.size() >= 2 && journal[0] == "reclaim");
  CHECK(f.closes == 1);
  f.controller.popupClosed();
  CHECK(!f.controller.popupAlive());
  // Sans PiP, rien ne se passe — et une annonce en attente est oubliée.
  Fixture g;
  g.controller.arm(Mode::floating, 480, 270);
  g.controller.hostClosing();
  CHECK(g.controller.decide("tentacle-pip", "about:blank").kind == OpenDecision::Kind::deny);
}

void restoreThenClose() {
  journal.clear();
  Fixture f;
  f.open();
  f.platform.clock.advance(400);
  bool restored = false;
  f.controller.restore([&](bool v) { restored = v; });
  CHECK(!restored);
  f.platform.clock.advance(300);
  CHECK(restored);
  // Fermé en pleine animation : le retour est annoncé quand même.
  Fixture g;
  g.open();
  bool pending = false;
  g.controller.restore([&](bool v) { pending = v; });
  g.controller.close();
  CHECK(pending);
}

}  // namespace

void runControllerTests() {
  withoutPip();
  openLendsVideo();
  closeByPage();
  closedFromInside();
  quitWithPip();
  restoreThenClose();
}
