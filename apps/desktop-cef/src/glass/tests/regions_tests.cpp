// `regions.test.ts` d'Electron, porté à l'identique : les mêmes gestes attendus d'AppKit.
#include <algorithm>

#include "glass/regions.h"
#include "glass/tests/check.h"
#include "glass/tests/fake_backend.h"

using namespace glass_tests;

namespace {

Region region(const std::string& id, std::function<void(Region&)> extra = {}) {
  Region r;
  r.id = id;
  r.x = 20, r.y = 700, r.width = 600, r.height = 56, r.radius = 28;
  if (extra) extra(r);
  return r;
}

struct Setup {
  FakeBackend backend;
  ManualTimers timers;
  std::vector<std::string> logs;
  GlassRegions regions{backend, timers, [this](const std::string& m) { logs.push_back(m); }};
  void upsert(std::vector<Region> list) { regions.apply(Batch{std::nullopt, std::move(list), {}}, 1); }
  void remove(std::vector<std::string> ids) { regions.apply(Batch{std::nullopt, {}, std::move(ids)}, 1); }
  void enable(bool on) { regions.apply(Batch{on, {}, {}}, 1); }
  FakeView* root() { return backend.root(); }
  FakeView* container(size_t i = 0) {
    FakeView* r = root();
    return r && r->children.size() > i ? r->children[i] : nullptr;
  }
  nlohmann::json snap() { return regions.snapshot(); }
};

bool hasOp(const std::vector<std::string>& ops, const std::string& op) {
  return std::find(ops.begin(), ops.end(), op) != ops.end();
}

void nothingUnused() {
  {  // sans région, la fenêtre n'a ni racine ni conteneur
    Setup t;
    t.enable(true);
    CHECK(t.root() == nullptr);
    CHECK(t.backend.ops.empty());
  }
  {  // une région : racine, conteneur, verre — au bon endroit, axe retourné
    Setup t;
    t.upsert({region("barre")});
    const auto glass = FakeBackend::glasses(t.container());
    CHECK(glass.size() == 1 && glass[0]->frame == (Rect{20, 44, 600, 56}));
    const auto s = t.snap();
    CHECK(s["root"] == true && s["groups"] == 1 && s["nativeViews"] == 1);
  }
  {  // la dernière région partie, verre, conteneur et racine partent avec elle
    Setup t;
    t.upsert({region("barre")});
    t.remove({"barre"});
    CHECK(t.root() == nullptr);
    const auto& ops = t.backend.ops;
    CHECK(ops.size() >= 3 && std::vector<std::string>(ops.end() - 3, ops.end()) ==
                                 (std::vector<std::string>{"dispose glass", "dispose container", "dispose root"}));
  }
}

void writeOnlyChanges() {
  {  // une région renvoyée telle quelle ne coûte aucun geste
    Setup t;
    t.upsert({region("barre")});
    const size_t before = t.backend.ops.size();
    t.upsert({region("barre")});
    CHECK(t.backend.ops.size() == before);
  }
  {  // chaque propriété changée, et elle seule ; un déplacement suit le ressort morph
    Setup t;
    t.upsert({region("barre")});
    t.backend.ops.clear();
    t.upsert({region("barre", [](Region& r) { r.y = 600, r.transition = 180; })});
    CHECK(t.backend.ops == std::vector<std::string>{"setFrame ressort 291"});
    t.backend.ops.clear();
    t.upsert({region("barre", [](Region& r) {
      r.y = 600, r.transition = 180, r.level = Level::Clear, r.tint = "#7C3AED80", r.appearance = Appearance::Dark;
    })});
    CHECK(t.backend.ops == (std::vector<std::string>{"setStyle", "setTint", "setAppearance dark"}));
    t.backend.ops.clear();
    t.upsert({region("barre", [](Region& r) {
      r.y = 500, r.level = Level::Clear, r.tint = "#7C3AED80", r.appearance = Appearance::Dark;
    })});
    CHECK(t.backend.ops == std::vector<std::string>{"setFrame direct"});  // sans transition : direct
  }
  {  // le ressort de la région remplace morph (lens : 439 ms)
    Setup t;
    t.upsert({region("pastille")});
    t.backend.ops.clear();
    t.upsert({region("pastille", [](Region& r) { r.x = 90, r.transition = 200, r.spring = SpringSpec{0.32, 0.55}; })});
    CHECK(t.backend.ops == std::vector<std::string>{"setFrame ressort 439"});
  }
  {  // le zoom s'applique au rectangle et au rayon ; l'apparence est posée à la naissance
    Setup t;
    t.regions.apply(Batch{std::nullopt,
                          {region("barre", [](Region& r) { r.y = 0, r.height = 40, r.radius = 20, r.appearance = Appearance::Dark; })},
                          {}},
                    1.5);
    const auto glass = FakeBackend::glasses(t.container());
    CHECK(glass.size() == 1 && glass[0]->frame == (Rect{30, 800 - 60, 900, 60}));
    CHECK(glass.size() == 1 && glass[0]->radius == 30 && glass[0]->appearance == Appearance::Dark);
  }
}

void depthAndGroups() {
  const auto in = [](const char* g, double z, double radius) {
    return [=](Region& r) { r.group = g, r.z = z, r.radius = radius; };
  };
  {  // dans un groupe, la profondeur décide de l'empilement, l'arrivée départage
    Setup t;
    t.upsert({region("haut", in("lecteur", 5, 5)), region("bas", in("lecteur", 0, 1)), region("milieu", in("lecteur", 2, 2))});
    t.upsert({region("milieu-bis", in("lecteur", 2, 3))});
    CHECK(FakeBackend::stackOf(t.container()) == (std::vector<double>{1, 2, 3, 5}));
    t.upsert({region("bas", in("lecteur", 9, 1))});
    CHECK(FakeBackend::stackOf(t.container()) == (std::vector<double>{2, 3, 5, 1}));
  }
  {  // entre régions seules, la profondeur range leurs conteneurs
    Setup t;
    t.upsert({region("dessus", [](Region& r) { r.z = 3, r.radius = 3; }), region("dessous", [](Region& r) { r.z = 1, r.radius = 1; })});
    std::vector<double> order;
    for (FakeView* c : t.root()->children) order.push_back(FakeBackend::glasses(c)[0]->radius);
    CHECK(order == (std::vector<double>{1, 3}));
  }
  {  // un groupe, un conteneur ; une région seule, le sien ; la plus grande distance de fusion
    Setup t;
    t.upsert({region("a", [](Region& r) { r.group = "lecteur", r.spacing = 8; }),
              region("b", [](Region& r) { r.group = "lecteur", r.spacing = 20; }), region("c", [](Region& r) { r.spacing = 30; })});
    CHECK(t.snap()["groups"] == 2);
    std::vector<double> spacings;
    for (FakeView* c : t.root()->children) spacings.push_back(c->spacing);
    std::sort(spacings.begin(), spacings.end());
    CHECK(spacings == (std::vector<double>{0, 20}));  // la région seule ne fusionne jamais
  }
  {  // changer de groupe repose la vue, et l'ancien conteneur vide part
    Setup t;
    t.upsert({region("a", [](Region& r) { r.group = "un"; })});
    t.upsert({region("a", [](Region& r) { r.group = "deux"; })});
    const auto s = t.snap();
    CHECK(s["groups"] == 1 && s["nativeViews"] == 1 && s["regions"][0]["group"] == "deux");
  }
}

void nativeMotions() {
  {  // une région seule entre et sort par le fondu de SON conteneur — jamais par l'alpha du verre
    Setup t;
    t.upsert({region("toast", [](Region& r) { r.transition = 200; })});
    CHECK(hasOp(t.backend.ops, "createGroup 0 alpha 0"));
    CHECK(hasOp(t.backend.ops, "setAlpha container 1 200"));
    t.remove({"toast"});
    CHECK(t.backend.ops.back() == "setAlpha container 0 200");
    CHECK(t.root() != nullptr);
    t.timers.runAll();
    CHECK(t.root() == nullptr);
  }
  {  // un groupe qui naît entre en fondu ENTIER : ses membres ne grandissent pas
    Setup t;
    const auto g = [](Region& r) { r.group = "lecteur", r.transition = 220; };
    t.upsert({region("a", g), region("b", g)});
    std::vector<std::string> alphas;
    for (const auto& op : t.backend.ops)
      if (op.rfind("setAlpha", 0) == 0) alphas.push_back(op);
    CHECK(alphas == std::vector<std::string>{"setAlpha container 1 220"});
    CHECK(std::none_of(t.backend.ops.begin(), t.backend.ops.end(), [](auto& op) { return op.rfind("setFrame", 0) == 0; }));
  }
  {  // un membre qui rejoint un groupe visible naît de son centre, au ressort
    Setup t;
    t.upsert({region("a", [](Region& r) { r.group = "lecteur", r.transition = 220; })});
    t.backend.ops.clear();
    t.upsert({region("b", [](Region& r) { r.group = "lecteur", r.transition = 220, r.x = 100; })});
    CHECK(hasOp(t.backend.ops, "setFrame ressort 291"));
    CHECK(std::none_of(t.backend.ops.begin(), t.backend.ops.end(), [](auto& op) { return op.rfind("setAlpha", 0) == 0; }));
  }
  {  // un membre qui quitte un groupe qui reste fond vers son centre, puis part
    Setup t;
    t.upsert({region("a", [](Region& r) { r.group = "lecteur"; }),
              region("b", [](Region& r) { r.group = "lecteur", r.x = 300, r.transition = 200; })});
    t.remove({"b"});
    CHECK(t.backend.ops.back() == "setFrame ressort 291");
    bool shrunk = false;
    for (FakeView* v : FakeBackend::glasses(t.container()))
      if (v->frame.width == 0 && v->frame.height == 0) shrunk = true;
    CHECK(shrunk);
    t.timers.runAll();
    CHECK(t.snap()["nativeViews"] == 1);
  }
  {  // un groupe qui se vide sort en fondu ENTIER
    Setup t;
    const auto g = [](Region& r) { r.group = "lecteur", r.transition = 180; };
    t.upsert({region("a", g), region("b", g)});
    t.backend.ops.clear();
    t.remove({"a", "b"});
    CHECK(t.backend.ops == std::vector<std::string>{"setAlpha container 0 180"});
    t.timers.runAll();
    CHECK(t.root() == nullptr);
  }
  {  // couper le réglage pendant les fondus les solde tous, sans toucher une poignée rendue
    Setup t;
    t.upsert({region("toast", [](Region& r) { r.transition = 200; }), region("a", [](Region& r) { r.group = "g"; }),
              region("b", [](Region& r) { r.group = "g", r.transition = 200; })});
    t.remove({"toast", "b"});
    t.enable(false);
    CHECK(t.root() == nullptr);
    CHECK(t.timers.size() == 0);
  }
}

void settingPageWindow() {
  {  // coupé : plus AUCUNE vue native ; rallumé : tout revient à l'identique
    Setup t;
    const auto in = [](double z, double radius, double x = 20) {
      return [=](Region& r) { r.group = "lecteur", r.z = z, r.radius = radius, r.x = x; };
    };
    t.upsert({region("a", in(1, 1)), region("b", in(0, 2))});
    t.enable(false);
    CHECK(t.root() == nullptr);
    const auto s = t.snap();
    CHECK(s["enabled"] == false && s["nativeViews"] == 0 && s["root"] == false);
    t.upsert({region("a", in(1, 1, 99))});
    CHECK(t.root() == nullptr);
    t.enable(true);
    CHECK(FakeBackend::stackOf(t.container()) == (std::vector<double>{2, 1}));
    const auto glass = FakeBackend::glasses(t.container());
    CHECK(glass.size() == 2 && glass[1]->frame.x == 99);
  }
  {  // surface opaque : la racine naît cachée, et se montre avec la lecture
    Setup t;
    t.regions.setSurfaceVisible(false);
    t.upsert({region("barre")});
    CHECK(t.root() && t.root()->hidden);
    CHECK(t.snap()["regions"][0]["hidden"] == true);
    t.regions.setSurfaceVisible(true);
    CHECK(t.root() && !t.root()->hidden);
  }
  {  // la page rechargée : plus rien de ce qu'elle avait demandé
    Setup t;
    t.upsert({region("a")});
    t.regions.clear();
    CHECK(t.root() == nullptr);
    CHECK(t.snap()["regions"].empty());
  }
  {  // la fenêtre détruite : les références sont rendues, rien n'est retiré
    Setup t;
    t.upsert({region("a", [](Region& r) { r.transition = 100; }), region("b")});
    t.remove({"a"});
    t.backend.ops.clear();
    t.regions.forget();
    // b (verre, conteneur), a qui s'estompe (verre, conteneur), la racine.
    CHECK(std::all_of(t.backend.ops.begin(), t.backend.ops.end(), [](auto& op) { return op.rfind("release", 0) == 0; }));
    CHECK(t.backend.ops.size() == 5);
    CHECK(t.timers.size() == 0);
  }
  {  // au-delà de 64 régions, la page fuit : on ignore, et on le dit une fois
    Setup t;
    std::vector<Region> many;
    for (int i = 0; i < kMaxRegions + 5; ++i) many.push_back(region("r" + std::to_string(i)));
    t.upsert(many);
    t.upsert({region("encore")});
    CHECK(t.snap()["regions"].size() == static_cast<size_t>(kMaxRegions));
    CHECK(t.logs.size() == 1);
  }
}

}  // namespace

void runRegionsTests() {
  nothingUnused();
  writeOnlyChanges();
  depthAndGroups();
  nativeMotions();
  settingPageWindow();
}
