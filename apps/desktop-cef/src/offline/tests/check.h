#pragma once
// Mini-harnais de test (comme `src/bridge/tests`) : un échec imprime sa ligne, le code de
// sortie compte les échecs. Chaque fichier de tests déclare ses cas par `TEST(nom)`.

#include <cstdio>
#include <filesystem>
#include <functional>
#include <string>
#include <vector>

namespace offline_tests {

struct Case {
  const char* name;
  std::function<void()> body;
};

std::vector<Case>& cases();
int& failures();

struct Register {
  Register(const char* name, std::function<void()> body) { cases().push_back({name, std::move(body)}); }
};

/// Dossier temporaire neuf, effacé à la destruction.
struct TempDir {
  std::filesystem::path path;
  TempDir();
  ~TempDir();
};

/// Le texte d'un fichier du dépôt (chemin relatif à la racine du monorepo).
std::string repoFile(const std::string& relative);

}  // namespace offline_tests

#define OT_CAT2(a, b) a##b
#define OT_CAT(a, b) OT_CAT2(a, b)
#define TEST(name)                                                              \
  static void name();                                                           \
  static offline_tests::Register OT_CAT(reg_, name)(#name, name);               \
  static void name()

#define CHECK(cond)                                                                          \
  do {                                                                                       \
    if (!(cond)) {                                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond);                \
      offline_tests::failures()++;                                                           \
    }                                                                                        \
  } while (0)

#define CHECK_THROWS(expr)            \
  do {                                \
    bool threw_ = false;              \
    try {                             \
      (void)(expr);                   \
    } catch (...) {                   \
      threw_ = true;                  \
    }                                 \
    CHECK(threw_ && #expr);           \
  } while (0)
