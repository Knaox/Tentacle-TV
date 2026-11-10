// Les charges des commandes `pip_*`, comme les schémas zod d'Electron (`ipc/pip.ts`).
#include "pip/rules/pip_payload.h"
#include "pip/tests/check.h"

using namespace tentacle::pip;

namespace {

template <typename T>
bool ok(const Parsed<T>& p) {
  return std::holds_alternative<T>(p);
}

template <typename T>
std::string error(const Parsed<T>& p) {
  return ok(p) ? std::string() : std::get<std::string>(p);
}

Json j(const char* text) { return Json::parse(text); }

}  // namespace

void runPayloadTests() {
  // pip_open : mode, et une taille de VIDÉO entière entre 64 et 8192.
  const auto open = parseOpen(j(R"({"mode":"floating","width":480,"height":270,"extra":1})"));
  CHECK(ok(open));
  CHECK(std::get<OpenArgs>(open).width == 480 && std::get<OpenArgs>(open).mode == Mode::floating);
  CHECK(ok(parseOpen(j(R"({"mode":"docked","width":480.0,"height":270})"))));
  CHECK(!ok(parseOpen(j(R"({"mode":"floating","width":480.5,"height":270})"))));
  CHECK(!ok(parseOpen(j(R"({"mode":"floating","width":63,"height":270})"))));
  CHECK(!ok(parseOpen(j(R"({"mode":"floating","width":480,"height":8193})"))));
  CHECK(!ok(parseOpen(j(R"({"mode":"floating","width":"480","height":270})"))));
  CHECK(!ok(parseOpen(j(R"({"mode":"mini","width":480,"height":270})"))));
  CHECK(!ok(parseOpen(Json())));
  CHECK(error(parseOpen(Json())).rfind("arguments invalides pour pip_open: ", 0) == 0);

  // pip_mode : la taille est facultative — absente, jamais `null`.
  const auto mode = parseMode(j(R"({"mode":"docked"})"));
  CHECK(ok(mode) && !std::get<ModeArgs>(mode).width);
  const auto sized = parseMode(j(R"({"mode":"floating","width":640,"height":360})"));
  CHECK(ok(sized) && std::get<ModeArgs>(sized).height == 360);
  CHECK(!ok(parseMode(j(R"({"mode":"docked","width":null})"))));
  CHECK(!ok(parseMode(j(R"({"width":640,"height":360})"))));

  // pip_resize
  CHECK(ok(parseResize(j(R"({"width":640,"height":360})"))));
  CHECK(!ok(parseResize(j(R"({"width":640})"))));

  // pip_gesture : un geste ou `null` (obligatoire), un point saisi facultatif et borné.
  const auto end = parseGesture(j(R"({"gesture":null})"));
  CHECK(ok(end) && !std::get<GestureArgs>(end).gesture);
  const auto move = parseGesture(j(R"({"gesture":"move","grab":{"x":162,"y":-3.5}})"));
  CHECK(ok(move) && std::get<GestureArgs>(move).gesture == Gesture::move);
  CHECK(ok(move) && std::get<GestureArgs>(move).grab == (Point{162, -3.5}));
  CHECK(ok(parseGesture(j(R"({"gesture":"bottom-left"})"))));
  CHECK(!ok(parseGesture(j(R"({})"))));
  CHECK(!ok(parseGesture(j(R"({"gesture":"left"})"))));
  CHECK(!ok(parseGesture(j(R"({"gesture":"move","grab":{"x":9000,"y":0}})"))));
  CHECK(!ok(parseGesture(j(R"({"gesture":"move","grab":{"x":1}})"))));

  // pip_restore, pip_close : un objet, ou rien.
  CHECK(!checkEmpty("pip_close", Json()).has_value());
  CHECK(!checkEmpty("pip_close", j(R"({"x":1})")).has_value());
  CHECK(checkEmpty("pip_restore", j("[1]")).has_value());
}
