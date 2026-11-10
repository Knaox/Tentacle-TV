// `materialize.test.ts` d'Electron, porté à l'identique.
#include <algorithm>

#include "glass/materialize.h"
#include "glass/regions.h"
#include "glass/tests/check.h"
#include "glass/tests/fake_backend.h"
#include "glass/validate.h"

using namespace glass_tests;

namespace {

const Materialize M{6, 0.96, 0.5, 0.5, 30, 180, {0.2, 0.9, 0.3, 1}, {0.4, 0, 1, 1}};

Region region(const std::string& id, std::function<void(Region&)> extra = {}) {
  Region r;
  r.id = id;
  r.x = 100, r.y = 700, r.width = 200, r.height = 48, r.radius = 24;
  r.level = Level::Clear;
  r.transition = 340;
  r.materialize = M;
  if (extra) extra(r);
  return r;
}

struct Setup {
  FakeBackend backend;
  ManualTimers timers;
  GlassRegions regions{backend, timers, [](const std::string&) {}};
  void upsert(std::vector<Region> list) { regions.apply(Batch{std::nullopt, std::move(list), {}}, 1); }
  void remove(std::vector<std::string> ids) { regions.apply(Batch{std::nullopt, {}, std::move(ids)}, 1); }
  std::vector<FakeView*> containers() {
    FakeView* r = backend.root();
    return r ? r->children : std::vector<FakeView*>{};
  }
};

bool hasOp(const std::vector<std::string>& ops, const std::string& op) {
  return std::find(ops.begin(), ops.end(), op) != ops.end();
}

bool closeRect(const Rect& a, const Rect& b) {
  const auto close = [](double u, double v) { return std::abs(u - v) < 1e-9; };
  return close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);
}

void startFrame() {
  // réduit autour de l'origine, puis descend de `rise` (axe d'AppKit : vers le bas, y diminue)
  const Rect frame{100, 52, 200, 48};
  CHECK(closeRect(materializeFrom(frame, M, 1), Rect{104, 52 + 0.96 - 6, 192, 46.08}));
  // Origine en bas à droite (un popover qui naît de son bouton) : le coin bas-droit ne bouge pas.
  Materialize corner = M;
  corner.rise = 0, corner.originX = 1, corner.originY = 1;
  const Rect c = materializeFrom(frame, corner, 1);
  CHECK_CLOSE(c.x + c.width, 300, 2);
  CHECK_CLOSE(c.y, 52, 2);
  // Zoom 2 : le décalage est en px CSS.
  Materialize flat = M;
  flat.scale = 1;
  CHECK(materializeFrom(frame, flat, 2).y == 52 - 12);
}

void regionMaterializes() {
  {  // naît transparente, au cadre de départ ; après son décalage, monte et s'allume sur la courbe de la page
    Setup t;
    t.upsert({region("transport")});
    const auto containers = t.containers();
    CHECK(containers.size() == 1 && containers[0]->alpha == 0);
    FakeView* glass = FakeBackend::glasses(containers[0])[0];
    CHECK_CLOSE(glass->frame.width, 192, 2);
    CHECK(!hasOp(t.backend.ops, "setFrame ressort 340"));
    t.timers.runAll();  // le décalage
    CHECK(hasOp(t.backend.ops, "setFrame ressort 340"));
    CHECK(hasOp(t.backend.ops, "setAlpha container 1 340 [0.2,0.9,0.3,1]"));
    CHECK(glass->frame == (Rect{100, 52, 200, 48}));
  }
  {  // sans décalage, l'entrée attend quand même un tour (le cadre de départ validé d'abord)
    Setup t;
    t.upsert({region("transport", [](Region& r) { r.materialize->delay = 0; })});
    CHECK(!hasOp(t.backend.ops, "setAlpha container 1 340 [0.2,0.9,0.3,1]"));
    CHECK(t.timers.size() == 1);
    t.timers.runAll();
    CHECK(hasOp(t.backend.ops, "setAlpha container 1 340 [0.2,0.9,0.3,1]"));
  }
  {  // chaque forme a SON conteneur : leurs fondus sont décalés, pas partagés
    Setup t;
    t.upsert({region("a"), region("b", [](Region& r) { r.x = 320, r.materialize->delay = 60; })});
    CHECK(t.containers().size() == 2);
  }
  {  // sort plus vite qu'elle n'entre : redescend vers son départ, son conteneur s'éteint, puis 0 vue
    Setup t;
    t.upsert({region("transport")});
    t.timers.runAll();
    t.backend.ops.clear();
    t.remove({"transport"});
    CHECK(t.backend.ops == (std::vector<std::string>{"setFrame ressort 180", "setAlpha container 0 180 [0.4,0,1,1]"}));
    CHECK_CLOSE(t.backend.frames.back().width, 192, 2);
    CHECK(t.regions.snapshot()["nativeViews"] == 1);
    t.timers.runAll();
    const auto s = t.regions.snapshot();
    CHECK(s["nativeViews"] == 0 && s["root"] == false);
  }
  {  // retirée AVANT son décalage : l'entrée n'a jamais lieu, aucune poignée rendue n'est touchée
    Setup t;
    t.upsert({region("transport")});
    t.remove({"transport"});
    bool threw = false;
    try {
      t.timers.runAll();
    } catch (...) {
      threw = true;
    }
    CHECK(!threw);
    CHECK(!hasOp(t.backend.ops, "setAlpha container 1 340 [0.2,0.9,0.3,1]"));
    CHECK(t.regions.snapshot()["nativeViews"] == 0);
  }
  {  // le réglage coupé pendant le décalage annule l'entrée ; rallumé, la forme revient posée
    Setup t;
    t.upsert({region("transport")});
    t.regions.setEnabled(false);
    bool threw = false;
    try {
      t.timers.runAll();
    } catch (...) {
      threw = true;
    }
    CHECK(!threw);
    t.regions.setEnabled(true);
    const auto containers = t.containers();
    CHECK(containers.size() == 1 && containers[0]->alpha == 1);
    CHECK(FakeBackend::glasses(containers[0])[0]->frame == (Rect{100, 52, 200, 48}));
  }
  {  // dans un groupe, pas de matérialisation : le fondu du groupe entier
    Setup t;
    t.upsert({region("a", [](Region& r) { r.group = "player"; })});
    CHECK(hasOp(t.backend.ops, "setAlpha container 1 340"));
    CHECK(t.timers.size() == 0);
  }
}

void parseMaterialize() {
  // laisse passer une matérialisation propre, refuse une courbe hors de [0, 1] ou une échelle folle
  const nlohmann::json m = {{"rise", 6},  {"scale", 0.96}, {"originX", 0.5},
                            {"originY", 0.5}, {"delay", 30}, {"exit", 180},
                            {"enterEase", {0.2, 0.9, 0.3, 1}}, {"exitEase", {0.4, 0, 1, 1}}};
  const auto raw = [&](const std::string& id, const nlohmann::json& mat) {
    return nlohmann::json{{"id", id}, {"x", 100}, {"y", 700}, {"width", 200}, {"height", 48}, {"radius", 24},
                          {"level", "clear"}, {"tint", nullptr}, {"interactive", false}, {"z", 0},
                          {"transition", 340}, {"materialize", mat}};
  };
  const auto ok = parseBatch({{"upserts", {raw("a", m)}}, {"removes", nlohmann::json::array()}});
  CHECK(ok && ok->batch.upserts.size() == 1 && ok->batch.upserts[0].materialize == M);
  nlohmann::json badCurve = m, badScale = m;
  badCurve["enterEase"] = {0, 1.4, 0.3, 1};
  badScale["scale"] = 0;
  const auto bad = parseBatch({{"upserts", {raw("b", badCurve), raw("c", badScale)}}, {"removes", nlohmann::json::array()}});
  CHECK(bad && bad->rejected == 2);
}

}  // namespace

void runMaterializeTests() {
  startFrame();
  regionMaterializes();
  parseMaterialize();
}
