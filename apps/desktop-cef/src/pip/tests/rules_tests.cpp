// Les tests de règle d'Electron (`pip/*.test.ts`), portés à l'identique : ce sont eux qui
// disent « le même PiP ». Les règles de placement se rejouent avec le cadre des trois systèmes.
#include <cmath>

#include "pip/rules/pip_arming.h"
#include "pip/rules/pip_captions.h"
#include "pip/rules/pip_motion.h"
#include "pip/rules/pip_placement.h"
#include "pip/rules/pip_resize_guard.h"
#include "pip/tests/check.h"

using namespace tentacle::pip;

namespace {

const Box kScreen{0, 25, 1512, 924};

void placementWith(const Frame frame) {
  const double shadow = frame.shadow, inset = frame.inset();
  const Size w480 = windowSize(frame, 480, 270);
  // cornerPlacement : le cadre VISIBLE à la marge du coin bas-droit — l'ombre déborde.
  const Box corner = cornerPlacement(frame, w480, kScreen);
  CHECK(corner.x + corner.width - shadow == kScreen.x + kScreen.width - kMargin);
  CHECK(corner.y + corner.height - shadow == kScreen.y + kScreen.height - kMargin);
  CHECK(corner.width == w480.width && corner.height == w480.height);
  // resizeInPlace : rangé en bas à droite, il grandit vers le haut-gauche…
  const Box after = resizeInPlace(frame, corner, windowSize(frame, 640, 360), kScreen);
  CHECK(after.x + after.width == corner.x + corner.width);
  CHECK(after.y + after.height == corner.y + corner.height);
  // … en haut à gauche, vers le bas-droit.
  const Box topLeft = resizeInPlace(frame, {40, 60, w480.width, w480.height},
                                    windowSize(frame, 640, 360), kScreen);
  CHECK(topLeft.x == 40 && topLeft.y == 60);
  // clampVisible : laisse déborder l'ombre, jamais le cadre visible.
  const Box clamped = clampVisible(frame, {-500, 2000, w480.width, w480.height}, kScreen);
  CHECK(clamped.x == kScreen.x - shadow);
  CHECK(clamped.y + clamped.height - shadow == kScreen.y + kScreen.height);
  // dragTo : garde le point saisi sous le curseur.
  const Box start{400, 300, w480.width, w480.height};
  CHECK_BOX(dragTo(frame, start, {162, 102}, {700, 500}, kScreen), 538, 398, w480.width,
            w480.height);
  // stretchFrom : coin haut-gauche tiré, le bas-droit fixe, le ratio gardé.
  const Box s{800, 500, w480.width, w480.height};
  const Box tl = stretchFrom(frame, s, Gesture::topLeft, -160, -90, 1000);
  CHECK(tl.x + tl.width == s.x + s.width);
  CHECK(tl.y + tl.height == s.y + s.height);
  CHECK(tl.width - 2 * inset == 640);
  CHECK(tl.height - 2 * inset == 360);
  // Un geste seulement horizontal agit à mi-course.
  const Box br = stretchFrom(frame, s, Gesture::bottomRight, 160, 0, 1000);
  CHECK(br.x == s.x && br.y == s.y);
  CHECK(br.width - 2 * inset > 480 && br.width - 2 * inset < 640);
  // Ni sous la taille minimale, ni au-delà de la part d'écran.
  CHECK(stretchFrom(frame, s, Gesture::bottomRight, -2000, -2000, 1000).width - 2 * inset ==
        kMinVideoWidth);
  CHECK(stretchFrom(frame, s, Gesture::bottomRight, 5000, 5000, 900).width - 2 * inset == 900);
}

void motion() {
  const Frame frame = frameFor(Os::macos);
  // pictureIn : l'image 16:9 centrée dans une zone plus haute — bandes noires exclues.
  CHECK_BOX(pictureIn({116, 55, 1280, 778}, 16.0 / 9), 116, 84, 1280, 720);
  // Une image plus large que la zone (scope) touche les bords gauche et droit.
  const Box scope = pictureIn({0, 0, 1000, 1000}, 2.39);
  CHECK(scope.width == 1000);
  CHECK(scope.y == jsRound((1000 - 1000 / 2.39) / 2));
  // Un ratio illisible vaut 16:9.
  CHECK(pictureIn({0, 0, 1600, 1600}, std::nan("")).height == 900);
  // windowAround : la vidéo exactement sur l'image, liseré et ombre autour.
  const double i = frame.inset();
  CHECK_BOX(windowAround(frame, {116, 84, 1280, 720}), 116 - i, 84 - i, 1280 + 2 * i, 720 + 2 * i);
  // La courbe part de l'origine, arrive au but, décélère.
  CHECK(easeOutCubic(0) == 0);
  CHECK(easeOutCubic(1) == 1);
  CHECK(easeOutCubic(0.5) > 0.5);
  CHECK(easeOutCubic(2) == 1);
  const Box from{0, 0, 100, 50}, to{100, 200, 300, 150};
  CHECK(interpolateBox(from, to, 0) == from);
  CHECK(interpolateBox(from, to, 1) == to);
  CHECK_BOX(interpolateBox(from, to, 0.5), 50, 100, 200, 100);
}

void resizeGuard() {
  const Frame frame = frameFor(Os::macos);
  const double i = frame.inset();
  // Garde le ratio de l'image, cadre en plus.
  CHECK(boundedSize(frame, 640 + 2 * i, 16.0 / 9, 900) == (Size{640 + 2 * i, 360 + 2 * i}));
  // Ni sous les boutons, ni au-delà de la part permise.
  CHECK(boundedSize(frame, 100, 16.0 / 9, 900).width - 2 * i == kMinVideoWidth);
  CHECK(boundedSize(frame, 4000, 16.0 / 9, 900).width - 2 * i == 900);
  // Flottant : le coin gauche tiré, le bord droit reste en place.
  const Box current{500, 300, 480 + 2 * i, 270 + 2 * i};
  const Box next{400, 300, 580 + 2 * i, 270 + 2 * i};
  const Box guarded = guardResize(frame, Mode::floating, current, next, 16.0 / 9, 900, {});
  CHECK(guarded.x + guarded.width == current.x + current.width);
  CHECK(guarded.height - 2 * i == jsRound((guarded.width - 2 * i) * 9 / 16));
  // Ancré : collé au coin bas-droit de l'application, quel que soit le coin tiré.
  const Box app{100, 100, 1200, 800};
  const Box docked = guardResize(frame, Mode::docked, current, next, 16.0 / 9, 900, app);
  CHECK(docked.x + docked.width - frame.shadow == app.x + app.width - kMargin);
}

void arming() {
  const Frame frame = frameFor(Os::macos);
  Arming a;
  // Ne regarde que la fenêtre nommée — le reste suit le filtre ordinaire.
  a.arm(Mode::floating, 480, 270, 0);
  CHECK(a.decide("_blank", "https://example.org", 0, false, frame).kind ==
        OpenDecision::Kind::notPip);
  // L'annonce reste valable après une demande qui ne la concerne pas.
  const OpenDecision ok = a.decide(kFrameName, "about:blank", 10, false, frame);
  CHECK(ok.kind == OpenDecision::Kind::allow);
  CHECK(ok.window == (Size{480 + 2 * frame.inset(), 270 + 2 * frame.inset()}));
  CHECK(ok.mode == Mode::floating);
  // L'annonce est consommée : une seconde ouverture est refusée.
  CHECK(a.decide(kFrameName, "about:blank", 20, false, frame).kind == OpenDecision::Kind::deny);
  // Refuse une fenêtre que la page n'a pas annoncée.
  Arming b;
  CHECK(b.decide(kFrameName, "about:blank", 0, false, frame).kind == OpenDecision::Kind::deny);
  // Le mode ancré.
  b.arm(Mode::docked, 358, 201, 0);
  CHECK(b.decide(kFrameName, "about:blank", 1, false, frame).mode == Mode::docked);
  // Une autre adresse qu'about:blank, une annonce périmée, un PiP déjà ouvert.
  b.arm(Mode::floating, 480, 270, 0);
  CHECK(b.decide(kFrameName, "https://evil.example", 1, false, frame).kind ==
        OpenDecision::Kind::deny);
  b.arm(Mode::floating, 480, 270, 0);
  CHECK(b.decide(kFrameName, "about:blank", 5000, false, frame).kind == OpenDecision::Kind::deny);
  b.arm(Mode::floating, 480, 270, 0);
  CHECK(b.decide(kFrameName, "about:blank", 1, true, frame).kind == OpenDecision::Kind::deny);
  // Titre de naissance : la colle (Linux) y lit l'entrée ; la coquille ailleurs, le titre nu.
  CHECK(birthCaption(Mode::floating, false, false) ==
        commandCaption(Mode::floating, {Command::Kind::enter, kShrinkMs}));
  CHECK(birthCaption(Mode::docked, false, false).rfind(std::string(kCaptionDocked) + " [enter ", 0) == 0);
  CHECK(birthCaption(Mode::floating, true, false) == kCaptionFloating);
  CHECK(birthCaption(Mode::floating, false, true) == kCaptionFloating);
}

void captions() {
  CHECK(caption(Mode::floating, std::nullopt) == "Tentacle TV · Picture-in-Picture");
  CHECK(caption(Mode::docked, Gesture::topLeft) == "Tentacle TV · Mini player [top-left]");
  CHECK(caption(Mode::floating, Gesture::move, Point{162.4, 102.5}) ==
        "Tentacle TV · Picture-in-Picture [move 162 103]");
  CHECK(commandCaption(Mode::floating, {Command::Kind::size, 120, 488.4, 278}) ==
        "Tentacle TV · Picture-in-Picture [size 488 278 120]");
  CHECK(commandCaption(Mode::docked, {Command::Kind::restore, -5}) ==
        "Tentacle TV · Mini player [restore 0]");
}

}  // namespace

void runRulesTests() {
  placementWith(frameFor(Os::macos));
  placementWith(frameFor(Os::linux));
  placementWith(frameFor(Os::windows));
  motion();
  resizeGuard();
  arming();
  captions();
  CHECK(frameFor(Os::macos).shadow == 4 && frameFor(Os::macos).bezel == 4);
  CHECK(frameFor(Os::linux).shadow == 14 && frameFor(Os::linux).bezel == 4);
  CHECK(frameFor(Os::windows).inset() == 0);
}
