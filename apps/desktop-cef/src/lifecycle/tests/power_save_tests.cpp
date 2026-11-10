// Portage de `powerSave.test.ts` et `linux/logindInhibitor.test.ts` : un blocage empilé, ou
// jamais rendu, ne se voit qu'une heure plus tard, sur la machine de quelqu'un d'autre.

#include <set>
#include <string>
#include <vector>

#include "lifecycle/power_save.h"
#include "tests/check.h"

using namespace tentacle::lifecycle;

namespace {

// `powerSaveBlocker` de bureau, en mémoire.
struct FakeBlocker final : SleepBlocker {
  std::set<int> active;
  std::vector<BlockerKind> types;
  int next = 1, startups = 0;
  int start(BlockerKind kind) override {
    startups++;
    types.push_back(kind);
    active.insert(next);
    return next++;
  }
  void stop(int id) override { active.erase(id); }
  bool isStarted(int id) const override { return active.count(id) > 0; }
};

struct FakeChild final : ChildProcess {
  bool* killed;
  explicit FakeChild(bool* k) : killed(k) {}
  void kill() override { *killed = true; }
  bool done() override { return *killed; }
};

struct Launched {
  std::string command;
  std::vector<std::string> args;
  bool killed = false;
};

void display() {
  CASE("veille de l'écran : pose un blocage, et un seul");
  {
    FakeBlocker b;
    auto lock = createDisplayWakeLock(b);
    lock->prevent();
    lock->prevent();
    lock->prevent();
    CHECK(b.startups == 1 && b.active.size() == 1);
    CHECK(b.types == std::vector<BlockerKind>{BlockerKind::PreventDisplaySleep});
  }
  CASE("veille de l'écran : rend le blocage");
  {
    FakeBlocker b;
    auto lock = createDisplayWakeLock(b);
    lock->prevent();
    lock->release();
    CHECK(b.active.empty());
  }
  CASE("veille de l'écran : ne fait rien quand il n'y a rien à rendre");
  {
    FakeBlocker b;
    auto lock = createDisplayWakeLock(b);
    lock->release();
    lock->release();
    CHECK(b.startups == 0 && b.active.empty());
  }
  CASE("veille de l'écran : repose un blocage après l'avoir rendu");
  {
    FakeBlocker b;
    auto lock = createDisplayWakeLock(b);
    lock->prevent();
    lock->release();
    lock->prevent();
    CHECK(b.startups == 2 && b.active.size() == 1);
  }
  CASE("veille de l'écran : repose un blocage que le système a levé");
  {
    FakeBlocker b;
    auto lock = createDisplayWakeLock(b);
    lock->prevent();
    b.stop(*b.active.begin());
    lock->prevent();
    CHECK(b.startups == 2 && b.active.size() == 1);
  }
}

void systemSleep() {
  CASE("veille du système : demande l'anti-suspension, pas l'anti-veille de l'écran");
  {
    FakeBlocker b;
    createSystemWakeLock(b)->prevent();
    CHECK(b.types == std::vector<BlockerKind>{BlockerKind::PreventAppSuspension});
  }
  CASE("veille du système : pose un blocage, et un seul ; le rend");
  {
    FakeBlocker b;
    auto lock = createSystemWakeLock(b);
    lock->prevent();
    lock->prevent();
    CHECK(b.startups == 1);
    lock->release();
    CHECK(b.active.empty());
  }
  CASE("les deux blocages cohabitent : rendre l'un laisse l'autre posé");
  {
    FakeBlocker b;
    auto display = createDisplayWakeLock(b);
    auto sys = createSystemWakeLock(b);
    display->prevent();
    sys->prevent();
    sys->release();
    CHECK(b.active.size() == 1);
    display->release();
    CHECK(b.active.empty());
  }
}

void logind() {
  std::vector<Launched> launched;
  auto launch = [&](const std::string& command, const std::vector<std::string>& args) -> std::unique_ptr<ChildProcess> {
    launched.push_back({command, args, false});
    return std::make_unique<FakeChild>(&launched.back().killed);
  };
  auto has = [](const std::vector<std::string>& v, const std::string& s) {
    for (const auto& x : v) if (x == s) return true;
    return false;
  };
  CASE("renfort logind : bloque l'inactivité ET la veille explicite");
  {
    launched.clear();
    launched.reserve(4);
    createLogindBackup(launch, 1)->prevent();
    CHECK(launched.size() == 1 && launched[0].command == "systemd-inhibit");
    CHECK(has(launched[0].args, "--what=idle:sleep") && has(launched[0].args, "--mode=block"));
  }
  CASE("renfort logind : le fils s'arrête avec l'application — jamais un verrou orphelin");
  {
    launched.clear();
    launched.reserve(4);
    createLogindBackup(launch, 4242)->prevent();
    const auto& a = launched[0].args;
    const std::vector<std::string> tail{"tail", "--pid=4242", "-f", "/dev/null"};
    CHECK(a.size() >= 4 && std::vector<std::string>(a.end() - 4, a.end()) == tail);
    CHECK(!has(a, "infinity"));
  }
  CASE("renfort logind : idempotent ; relance si le processus est mort de son côté");
  {
    launched.clear();
    launched.reserve(4);
    auto v = createLogindBackup(launch, 1);
    v->prevent();
    v->prevent();
    v->prevent();
    CHECK(launched.size() == 1);
    launched[0].killed = true;
    v->prevent();
    CHECK(launched.size() == 2);
  }
  CASE("renfort logind : libère, et ne libère pas deux fois");
  {
    launched.clear();
    launched.reserve(4);
    auto v = createLogindBackup(launch, 1);
    v->prevent();
    v->release();
    v->release();
    CHECK(launched[0].killed);
  }
  CASE("renfort logind : s'efface sans bruit là où systemd-inhibit n'existe pas");
  {
    auto v = createLogindBackup([](const std::string&, const std::vector<std::string>&) { return nullptr; }, 1);
    v->prevent();
    v->release();
    CHECK(true);
  }
  CASE("combiner : n'oublie aucune des deux, dans les deux sens");
  {
    std::vector<std::string> trace;
    struct Traced final : WakeLock {
      std::vector<std::string>& t;
      std::string n;
      Traced(std::vector<std::string>& tr, std::string name) : t(tr), n(std::move(name)) {}
      void prevent() override { t.push_back("+" + n); }
      void release() override { t.push_back("-" + n); }
    };
    std::vector<std::unique_ptr<WakeLock>> locks;
    locks.push_back(std::make_unique<Traced>(trace, "a"));
    locks.push_back(std::make_unique<Traced>(trace, "b"));
    auto c = combine(std::move(locks));
    c->prevent();
    c->release();
    CHECK((trace == std::vector<std::string>{"+a", "+b", "-a", "-b"}));
  }
}

}  // namespace

void runPowerSaveTests() {
  display();
  systemSleep();
  logind();
}
