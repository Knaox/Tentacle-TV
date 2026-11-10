#pragma once
// Petit outil de test des règles du module réseau, sans dépendance (comme ceux du pont) :
// un échec imprime sa ligne, le code de sortie compte les échecs.
#include <cstdio>

inline int g_failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      g_failures++;                                                          \
    }                                                                        \
  } while (0)
#define CHECK_EQ(a, b)                                                                     \
  do {                                                                                     \
    const auto& va_ = (a);                                                                 \
    const auto& vb_ = (b);                                                                 \
    if (!(va_ == vb_)) {                                                                   \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s == %s\n", __FILE__, __LINE__, #a, #b);        \
      g_failures++;                                                                        \
    }                                                                                      \
  } while (0)
#define TEST_RESULT(name)                                       \
  (g_failures == 0 ? (std::printf("%s : OK\n", name), 0)        \
                   : (std::fprintf(stderr, "%s : %d échec(s)\n", name, g_failures), 1))
