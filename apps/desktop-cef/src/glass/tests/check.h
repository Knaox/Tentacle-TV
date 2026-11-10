#pragma once
// Sans dépendance de test, comme ceux du pont et du PiP : un échec imprime sa ligne, le code
// de sortie compte les échecs.
#include <cmath>
#include <cstdio>

namespace glass_tests {
inline int failures = 0;
}

#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      glass_tests::failures++;                                               \
    }                                                                        \
  } while (0)

/// `toBeCloseTo(v, digits)` de vitest : |a − b| < 10^−digits / 2.
#define CHECK_CLOSE(a, b, digits) CHECK(std::abs(static_cast<double>(a) - static_cast<double>(b)) < std::pow(10.0, -(digits)) / 2)

void runAvailabilityTests();
void runValidateTests();
void runGeometryTests();
void runSpringTests();
void runRegionsTests();
void runMaterializeTests();
void runLuminanceTests();
void runVideoLayoutTests();
