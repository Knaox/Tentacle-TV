#pragma once
// Sans dépendance de test, comme ceux du pont : un échec imprime sa ligne, le code de sortie
// compte les échecs.
#include <cstdio>

namespace pip_tests {
inline int failures = 0;
}

#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      pip_tests::failures++;                                                 \
    }                                                                        \
  } while (0)

#define CHECK_BOX(box, X, Y, W, H) \
  CHECK((box) == (tentacle::pip::Box{(X), (Y), (W), (H)}))

void runRulesTests();
void runPayloadTests();
void runSessionTests();
void runControllerTests();
