// Tests des règles « la page perdue » (render_recovery.h) et « secours d'affichage »
// (page_rescue.h). Sans CEF ni OS : un dossier temporaire, une horloge donnée.
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>

#include "shell/page_rescue.h"
#include "shell/render_recovery.h"

using namespace tentacle;
namespace fs = std::filesystem;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

static void crashPolicy() {
  using recovery::Target;
  recovery::CrashPolicy p;
  // « une première chute recharge la même page, tout de suite »
  auto s = p.onCrash(10'000);
  CHECK(s.target == Target::samePage && s.delayMs == 0 && s.strike == 1);
  // « une deuxième dans la minute ramène à l'accueil »
  s = p.onCrash(20'000);
  CHECK(s.target == Target::startPage && s.delayMs == 1000 && s.strike == 2);
  // « les suivantes attendent de plus en plus, sans jamais abandonner »
  CHECK(p.onCrash(25'000).delayMs == 2000);
  CHECK(p.onCrash(30'000).delayMs == 5000);
  CHECK(p.onCrash(40'000).delayMs == 10000);
  CHECK(p.onCrash(60'000).delayMs == 30000);
  s = p.onCrash(100'000);
  CHECK(s.delayMs == 30000 && s.target == Target::startPage && s.strike == 7);
  // « une minute sans chute, et le compteur repart »
  s = p.onCrash(100'000 + recovery::kCrashWindowMs + 1);
  CHECK(s.target == Target::samePage && s.delayMs == 0 && s.strike == 1);

  CHECK(recovery::describe(2, 11, "SIGSEGV", {Target::samePage, 0, 1}) ==
        "[rendu] le processus de rendu est tombé (plantage, code 11 SIGSEGV) — chute n° 1 : la page est rechargée");
  CHECK(recovery::describe(3, 9, "", {Target::startPage, 5000, 4}) ==
        "[rendu] le processus de rendu est tombé (mémoire épuisée, code 9) — chute n° 4 : retour à l'accueil dans 5 s");
}

static void rescueRule() {
  using rescue::Mode;
  const fs::path dir = fs::temp_directory_path() / "tentacle-page-rescue-tests" / "profil";
  fs::remove_all(dir.parent_path());
  const auto witness = dir / rescue::kWitnessFile, marker = dir / rescue::kRescueFile;

  // « un lancement normal pose le témoin (dossier créé au besoin), la preuve l'efface »
  CHECK(rescue::atStartup(dir.string(), false).mode == Mode::accelerated);
  CHECK(fs::exists(witness));
  rescue::pageShown(dir.string());
  CHECK(!fs::exists(witness) && !fs::exists(marker));

  // « un lancement qui n'a jamais montré la page : le suivant ne dépend plus du pilote »
  CHECK(rescue::atStartup(dir.string(), false).mode == Mode::accelerated);
  auto d = rescue::atStartup(dir.string(), false);  // le témoin est resté
  CHECK(d.mode == Mode::noGpu && d.launchesLeft == rescue::kRescueLaunches - 1);
  CHECK(!fs::exists(witness) && fs::exists(marker));
  CHECK(rescue::describe(d).find("Chromium sans GPU") != std::string::npos);
  // « le secours vaut un nombre fini de lancements, puis la voie accélérée est retentée »
  for (int left = rescue::kRescueLaunches - 2; left >= 0; --left) {
    d = rescue::atStartup(dir.string(), false);
    CHECK(d.mode == Mode::noGpu && d.launchesLeft == left);
  }
  CHECK(!fs::exists(marker));
  CHECK(rescue::atStartup(dir.string(), false).mode == Mode::accelerated);
  rescue::pageShown(dir.string());

  // « un import refusé : peinture logicielle, Chromium garde son GPU »
  rescue::atStartup(dir.string(), false);
  rescue::acceleratedRefused(dir.string(), "le pilote refuse l'import de la page (dmabuf)");
  CHECK(!fs::exists(witness));
  d = rescue::atStartup(dir.string(), false);
  CHECK(d.mode == Mode::softwarePaint && d.launchesLeft == rescue::kRescueLaunches - 1);
  CHECK(d.reason == "le pilote refuse l'import de la page (dmabuf)");
  CHECK(rescue::current().mode == Mode::softwarePaint);

  // « une seconde instance qui passe la main ne consomme rien »
  rescue::startupHandedOff(dir.string());
  d = rescue::atStartup(dir.string(), false);
  CHECK(d.mode == Mode::softwarePaint && d.launchesLeft == rescue::kRescueLaunches - 1);
  fs::remove(marker);
  CHECK(rescue::atStartup(dir.string(), false).mode == Mode::accelerated);
  rescue::startupHandedOff(dir.string());
  CHECK(!fs::exists(witness));  // sinon le prochain vrai lancement se croirait en échec

  // « l'outil d'essai ne touche ni au témoin ni au secours »
  d = rescue::atStartup(dir.string(), true);
  CHECK(d.mode == Mode::softwarePaint && !fs::exists(witness) && !fs::exists(marker));

  // « un marqueur illisible est soldé »
  { std::ofstream(marker) << "pas du json"; }
  CHECK(rescue::atStartup(dir.string(), false).mode == Mode::accelerated);
  CHECK(!fs::exists(marker));
  fs::remove_all(dir.parent_path());
}

static void importHealth() {
  // « trois refus d'emblée : cette voie ne donne rien — dit une seule fois »
  rescue::ImportHealth h;
  CHECK(!h.note(false) && !h.note(false));
  CHECK(h.note(false));
  CHECK(!h.note(false));
  // « un refus isolé après des images réussies n'est pas un verdict »
  rescue::ImportHealth ok;
  CHECK(!ok.note(true) && ok.everImported());
  for (int i = 0; i < rescue::kRefusalsLater - 1; ++i) CHECK(!ok.note(false));
  CHECK(!ok.note(true));
  // « deux secondes de refus après des réussites : verdict »
  for (int i = 0; i < rescue::kRefusalsLater - 1; ++i) CHECK(!ok.note(false));
  CHECK(ok.note(false));
}

int main() {
  crashPolicy();
  rescueRule();
  importHealth();
  if (failures) return 1;
  std::printf("page perdue, secours d'affichage : tout passe\n");
  return 0;
}
