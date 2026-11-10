// Tests du préchauffage du lecteur (`video_prewarm.h`) : qui fait naître l'instance mince, et
// quand. Sans libmpv : le faux lecteur dit ce qu'on lui a demandé.
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "registry.h"
#include "tests/fakes.h"
#include "video_prewarm.h"

using namespace bridge;
using namespace bridge::testing;
namespace fs = std::filesystem;

static int failures = 0;
#define CHECK(cond)                                                     \
  do {                                                                  \
    if (!(cond)) {                                                      \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                       \
    }                                                                   \
  } while (0)

// La charge de `mpv_prewarm` : celle de `mpv_init` (front, Linux).
static Json request() {
  return Json::parse(R"({"options":{"initialOptions":{"vo":"gpu-next","hwdec":"auto","keep-open":"yes"},
    "observedProperties":[["time-pos","double"]]}})");
}

struct Deferred {
  int ms;
  std::function<void()> task;
};

static void testCommand() {
  // « un lecteur qui ne sait pas préchauffer ne déclare pas la commande : la page ne demande rien »
  {
    FakeIpc ipc;
    Registry reg(ipc);
    FakePlayer player;
    VideoPrewarm prewarm(reg, player, {}, {}, {});
    CHECK(reg.commands().empty());
    prewarm.afterPlayback();
    prewarm.onSystemResume();
    CHECK(player.prewarms == 0);
  }
  FakeIpc ipc;
  Registry reg(ipc);
  FakePlayer player;
  player.prewarmable = true;
  bool battery = false;
  std::vector<Deferred> later, atRest;
  const auto rest = [&] {  // la page vient d'atteindre le repos
    auto tasks = std::move(atRest);
    atRest.clear();
    for (auto& t : tasks) t.task();
  };
  VideoPrewarm prewarm(reg, player, [&](int ms, std::function<void()> task) { later.push_back({ms, std::move(task)}); },
                       [&](int quietMs, std::function<void()> task) { atRest.push_back({quietMs, std::move(task)}); },
                       [&] { return battery; });
  CHECK(reg.commands() == std::vector<std::string>{"mpv_prewarm"});

  // « rien à reproduire tant que la page n'a rien demandé »
  prewarm.afterPlayback();
  CHECK(atRest.size() == 1 && atRest[0].ms == kPrewarmQuietMs);
  rest();
  CHECK(player.prewarms == 0 && prewarm.lastOutcome() == "aucune demande de la page à reproduire");

  // « la demande de la page n'agit qu'au REPOS — jamais sous un geste ni une animation »
  auto a = ipc.invoke("tentacle:mpv_prewarm", request());
  CHECK(a.ok && a.value == "attendue au repos de la page" && player.prewarms == 0);
  // « une seule attente à la fois »
  ipc.invoke("tentacle:mpv_prewarm", request());
  CHECK(atRest.size() == 1);
  rest();
  // « l'instance naît aux options que mpv_init filtrerait »
  CHECK(player.prewarms == 1 && prewarm.lastOutcome() == "préchauffée");
  CHECK(player.warmOptions && !player.warmOptions->contains("vo"));  // la sortie reste au lecteur
  CHECK(player.warmOptions && (*player.warmOptions)["hwdec"] == "auto");
  // « une seule instance à la fois »
  ipc.invoke("tentacle:mpv_prewarm", request());
  rest();
  CHECK(prewarm.lastOutcome() == "instance déjà là" && player.prewarms == 1);

  // « jamais pendant une lecture : le repos atteint pendant le film ne fait rien naître »
  player.dropWarm();
  player.live = true;
  ipc.invoke("tentacle:mpv_prewarm", request());
  rest();
  CHECK(prewarm.lastOutcome() == "lecture en cours" && player.prewarms == 1);

  // « après une lecture, une instance mince la remplace au repos — avec la dernière demande »
  player.live = false;
  prewarm.afterPlayback();
  CHECK(player.prewarms == 1);
  rest();
  CHECK(player.prewarms == 2 && player.warm());

  // « au réveil, l'instance garée part ; une neuve naît plus tard, au repos »
  prewarm.onSystemResume();
  CHECK(!player.warm() && later.size() == 1 && later[0].ms == kPrewarmResumeMs);
  later[0].task();
  CHECK(player.prewarms == 2);
  rest();
  CHECK(player.prewarms == 3);
  later.clear();

  // « jamais sur batterie »
  player.dropWarm();
  battery = true;
  ipc.invoke("tentacle:mpv_prewarm", request());
  rest();
  CHECK(prewarm.lastOutcome() == "sur batterie" && player.prewarms == 3 && !player.warm());
}

static void write(const fs::path& file, const std::string& text) {
  fs::create_directories(file.parent_path());
  std::ofstream(file) << text << "\n";
}

static void testBattery() {
  const fs::path root = fs::temp_directory_path() / "tentacle-prewarm-tests";
  fs::remove_all(root);
  CHECK(!onBattery((root / "absent").string()));  // hors Linux : pas de dossier
  write(root / "AC" / "type", "Mains");
  write(root / "AC" / "online", "1");
  CHECK(!onBattery(root.string()));  // poste fixe
  write(root / "BAT0" / "type", "Battery");
  write(root / "BAT0" / "status", "Charging");
  CHECK(!onBattery(root.string()));
  write(root / "BAT0" / "status", "Discharging");
  CHECK(onBattery(root.string()));
  // « la batterie d'une souris n'est pas celle de la machine »
  write(root / "BAT0" / "status", "Full");
  write(root / "hidpp_battery_0" / "type", "Battery");
  write(root / "hidpp_battery_0" / "scope", "Device");
  write(root / "hidpp_battery_0" / "status", "Discharging");
  CHECK(!onBattery(root.string()));
  fs::remove_all(root);
}

int main() {
  testCommand();
  testBattery();
  std::printf(failures ? "%d échec(s)\n" : "préchauffage du lecteur : tout passe\n", failures);
  return failures ? 1 : 0;
}
