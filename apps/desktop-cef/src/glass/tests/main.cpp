// Tests du verre natif : les règles d'Electron (`liquidGlass/*.test.ts`), portées à
// l'identique — ce sont elles qui disent « le même verre ».
#include <cstdio>
#include <exception>

#include "glass/tests/check.h"

int main() {
  try {
    runAvailabilityTests();
    runValidateTests();
    runGeometryTests();
    runSpringTests();
    runRegionsTests();
    runMaterializeTests();
    runLuminanceTests();
    runVideoLayoutTests();
  } catch (const std::exception& e) {
    std::fprintf(stderr, "ÉCHEC : exception %s\n", e.what());
    return 1 + glass_tests::failures;
  }
  if (glass_tests::failures == 0) std::printf("verre : tous les tests passent\n");
  return glass_tests::failures;
}
