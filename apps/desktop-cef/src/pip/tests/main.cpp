// Tests du PiP : règles portées d'Electron, charges, session, contrôleur.
#include <cstdio>

#include "pip/tests/check.h"

int main() {
  runRulesTests();
  runPayloadTests();
  runSessionTests();
  runControllerTests();
  if (pip_tests::failures == 0) std::printf("pip : tous les tests passent\n");
  return pip_tests::failures;
}
