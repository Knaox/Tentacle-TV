#include <cstdio>

#include "tests/check.h"

void runPlaybackFarewellTests();
void runPowerSaveTests();
void runExitRulesTests();
void runAppLinksTests();
void runExitFlowTests();

int main() {
  runPlaybackFarewellTests();
  runPowerSaveTests();
  runExitRulesTests();
  runAppLinksTests();
  runExitFlowTests();
  using namespace tentacle::lifecycle::testing;
  std::printf("tests du cycle de vie : %d vérifications, %d échec(s)\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
