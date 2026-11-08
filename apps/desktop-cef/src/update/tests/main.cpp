#include <cstdio>

#include "tests/check.h"

void runRuleTests();
void runEngineTests();
void runReviewTests();
void runInvariantTests();

int main() {
  runRuleTests();
  runEngineTests();
  runReviewTests();
  runInvariantTests();
  using namespace tentacle::update::testing;
  std::printf("tests maj : %d vérifications, %d échec(s)\n", checks, failures);
  return failures == 0 ? 0 : 1;
}
