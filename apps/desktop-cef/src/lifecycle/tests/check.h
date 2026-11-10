#pragma once
// Assertions minimales (comme les tests du pont et de maj) : un échec imprime sa ligne et le
// cas en cours, le code de sortie compte les échecs. Les noms de cas reprennent ceux des tests
// d'Electron (vitest) dont ils sont le portage.
#include <cstdio>

namespace tentacle::lifecycle::testing {
inline int failures = 0;
inline int checks = 0;
inline const char* current = "";
}  // namespace tentacle::lifecycle::testing

#define CASE(name) ::tentacle::lifecycle::testing::current = (name)

#define CHECK(cond)                                                                            \
  do {                                                                                         \
    ::tentacle::lifecycle::testing::checks++;                                                  \
    if (!(cond)) {                                                                             \
      std::fprintf(stderr, "ÉCHEC %s:%d [%s] : %s\n", __FILE__, __LINE__,                       \
                   ::tentacle::lifecycle::testing::current, #cond);                            \
      ::tentacle::lifecycle::testing::failures++;                                              \
    }                                                                                          \
  } while (0)
