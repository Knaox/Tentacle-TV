#pragma once
// Assertions minimales (comme les tests du pont) : un échec imprime sa ligne, le code de
// sortie compte les échecs.
#include <cstdio>

namespace tentacle::update::testing {
inline int failures = 0;
inline int checks = 0;
}  // namespace tentacle::update::testing

#define CHECK(cond)                                                              \
  do {                                                                           \
    ::tentacle::update::testing::checks++;                                       \
    if (!(cond)) {                                                               \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond);     \
      ::tentacle::update::testing::failures++;                                   \
    }                                                                            \
  } while (0)
