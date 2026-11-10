// Tests de la règle du dossier de données (shell/paths.h) — portage de
// `apps/desktop-electron/src/main/dataPaths.test.ts`, pour les trois OS depuis n'importe quelle
// machine. Sans dépendance de test : un échec imprime sa ligne, le code de sortie les compte.
#include <cstdio>
#include <string>

#include "shell/paths.h"

using namespace tentacle::paths;
namespace fs = std::filesystem;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

static DataEnvironment base(Platform p) {
  DataEnvironment e;
  e.platform = p;
  e.appData = "/Users/k/Library/Application Support";
  e.home = "/home/k";
  return e;
}

int main() {
  // suit appData sur macOS et Windows
  CHECK(dataRoot(base(Platform::kMacos)) == fs::path("/Users/k/Library/Application Support"));
  {
    DataEnvironment w = base(Platform::kWindows);
    w.appData = "C:\\Users\\k\\AppData\\Roaming";
    CHECK(dataRoot(w) == fs::path("C:\\Users\\k\\AppData\\Roaming"));
  }
  // sur Linux, le dossier XDG de DONNÉES, pas celui de configuration
  {
    DataEnvironment l = base(Platform::kLinux);
    l.appData = "/home/k/.config";
    CHECK(dataRoot(l) == fs::path("/home/k/.local/share"));
  }
  // respecte XDG_DATA_HOME quand il est absolu
  {
    DataEnvironment l = base(Platform::kLinux);
    l.xdgDataHome = "/data/xdg";
    CHECK(dataRoot(l) == fs::path("/data/xdg"));
  }
  // ignore un XDG_DATA_HOME vide ou relatif
  for (const char* xdg : {"", "  ", "relatif/xdg", "./xdg"}) {
    DataEnvironment l = base(Platform::kLinux);
    l.xdgDataHome = std::string(xdg);
    CHECK(dataRoot(l) == fs::path("/home/k/.local/share"));
  }
  // nomme le dossier avec l'identifiant Tauri
  CHECK(dataFolder(base(Platform::kLinux)) == fs::path("/home/k/.local/share/com.tentacle.media"));
  CHECK(dataFolder(base(Platform::kMacos)) ==
        fs::path("/Users/k/Library/Application Support/com.tentacle.media"));

  // --user-data remplace la règle ; sans lui, la règle de CE système
  configure({{"user-data", "/tmp/profil jetable/"}});
  CHECK(userData() == fs::path("/tmp/profil jetable/"));
  configure({{"autre", "x"}});
  CHECK(userData() == dataFolder(currentEnvironment()));
  CHECK(userData().filename() == "com.tentacle.media");
  configure({{"user-data", ""}});
  CHECK(userData() == dataFolder(currentEnvironment()));

  if (failures == 0) std::printf("paths : OK\n");
  return failures == 0 ? 0 : 1;
}
