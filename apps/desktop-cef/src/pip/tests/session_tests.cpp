// La session (`pipShell.ts`) : naissance sur l'image du lecteur, entrée animée, gestes,
// molette, modes, retour — sur une horloge manuelle.
#include "pip/rules/pip_motion.h"
#include "pip/rules/pip_placement.h"
#include "pip/tests/check.h"
#include "pip/tests/fakes.h"

using namespace pip_tests;

namespace {

const Frame kFrame = frameFor(Os::macos);
constexpr double kAspect = 16.0 / 9;

Box born(FakeDesktop& d) {
  Box area = d.hostContent;
  area.y += d.banner;
  area.height -= d.banner;
  return windowAround(kFrame, pictureIn(area, kAspect));
}

void birthAndEnter() {
  FakeDesktop desk;
  desk.banner = 22;
  FakeTicker clock;
  const Size size = windowSize(kFrame, 480, 270);
  FakeWindow win({0, 0, size.width, size.height});
  Session s(win, desk, clock, kFrame, Mode::floating, kAspect);
  // Né sur l'IMAGE du lecteur (sous le bandeau), pas sur sa zone.
  CHECK(win.box == born(desk));
  CHECK(win.modes == std::vector<Mode>{Mode::floating});
  s.enter();
  CHECK(s.animating());
  clock.advance(kShrinkMs + 40);
  CHECK(!s.animating());
  CHECK(win.box == cornerPlacement(kFrame, size, desk.work));
  CHECK(clock.running() == 0);
}

void reducedMotionJumps() {
  FakeDesktop desk;
  desk.reduced = true;
  FakeTicker clock;
  const Size size = windowSize(kFrame, 480, 270);
  FakeWindow win({0, 0, size.width, size.height});
  Session s(win, desk, clock, kFrame, Mode::floating, kAspect);
  CHECK(win.box == cornerPlacement(kFrame, size, desk.work));
  s.enter();
  CHECK(!s.animating());
}

void stepNeverJumps() {
  // Un trou du fil principal (200 ms) n'avance l'animation que de 34 ms.
  FakeDesktop desk;
  FakeTicker clock;
  const Size size = windowSize(kFrame, 480, 270);
  FakeWindow win({0, 0, size.width, size.height});
  Session s(win, desk, clock, kFrame, Mode::floating, kAspect);
  const Box from = win.box;
  s.enter();
  clock.advance(200, 200);
  const Box expected = interpolateBox(from, cornerPlacement(kFrame, size, desk.work),
                                      easeOutCubic(kMaxStepMs / kShrinkMs));
  CHECK(win.box == expected);
}

void gestures() {
  FakeDesktop desk;
  desk.reduced = true;
  FakeTicker clock;
  const Size size = windowSize(kFrame, 480, 270);
  FakeWindow win({0, 0, size.width, size.height});
  Session s(win, desk, clock, kFrame, Mode::floating, kAspect);
  // Glisser : le point saisi reste sous le curseur, une image après l'autre.
  desk.cursorAt = {900, 600};
  s.setGesture(Gesture::move, Point{100, 50});
  desk.cursorAt = {700, 500};
  clock.advance(16);
  CHECK(win.box.x == 600 && win.box.y == 450);
  s.setGesture(std::nullopt, std::nullopt);
  CHECK(!s.gesturing() && clock.running() == 0);
  // Tirer un coin : la taille voulue devient celle où la main l'a laissé.
  const Box before = win.box;
  desk.cursorAt = {1000, 700};
  s.setGesture(Gesture::bottomRight, std::nullopt);
  desk.cursorAt = {1160, 790};
  clock.advance(16);
  CHECK(win.box.x == before.x && win.box.width > before.width);
  s.setGesture(std::nullopt, std::nullopt);
  CHECK(s.wantedSize() == (Size{win.box.width, win.box.height}));
  // Ancré, le PiP est le coin de l'application : il ne se glisse pas.
  s.setMode(Mode::docked);
  const Box docked = win.box;
  CHECK(docked == cornerPlacement(kFrame, s.wantedSize(), desk.hostContent));
  s.setGesture(Gesture::move, Point{10, 10});
  CHECK(!s.gesturing());
  // Ancré, il suit l'application.
  desk.hostContent.x += 50;
  win.events.hostMoved();
  CHECK(win.box.x == docked.x + 50);
}

void wheelAndRestore() {
  FakeDesktop desk;
  FakeTicker clock;
  const Size size = windowSize(kFrame, 480, 270);
  FakeWindow win({0, 0, size.width, size.height});
  Session s(win, desk, clock, kFrame, Mode::floating, kAspect);
  s.enter();
  clock.advance(400);
  const Box corner = win.box;
  // La molette : le coin bas-droit reste fixe, la taille y glisse.
  s.resize(640, 360);
  CHECK(s.animating());
  clock.advance(kResizeMs + 32);
  CHECK(win.box.x + win.box.width == corner.x + corner.width);
  CHECK(win.box.width == 640 + 2 * kFrame.inset());
  // Un geste interrompt une animation : son achèvement est annoncé quand même.
  s.resize(700, 394);
  s.setGesture(Gesture::topLeft, std::nullopt);
  CHECK(!s.animating());
  s.setGesture(std::nullopt, std::nullopt);
  // Le retour : l'image regagne sa place dans le lecteur, une seule annonce.
  int done = 0;
  const Box pip = win.box;
  const double inset = 2 * kFrame.inset();
  s.restore([&] { done++; });
  clock.advance(kGrowMs + 40);
  CHECK(done == 1);
  const Box back = win.box;
  CHECK(back == windowAround(kFrame, pictureIn(desk.hostContent,
                                               (pip.width - inset) / (pip.height - inset))));
  // La garde du système : ratio et bornes tenus.
  const Box proposed{back.x, back.y, 5000, 300};
  const Box guarded = win.events.willResize(back, proposed);
  CHECK(guarded.width - inset == jsRound(desk.display.width * kMaxShareFloating));
}

}  // namespace

void runSessionTests() {
  birthAndEnter();
  reducedMotionJumps();
  stepNeverJumps();
  gestures();
  wheelAndRestore();
}
