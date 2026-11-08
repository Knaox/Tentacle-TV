// Tests de la règle de tentacle://app (shell/web_root.h), sur un faux build web jetable.
// Sans dépendance de test, comme ceux du pont : un échec imprime sa ligne, le code de
// sortie compte les échecs.
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>

#include <unistd.h>

#include "shell/web_root.h"

namespace fs = std::filesystem;
using tentacle::webroot::percentDecode;
using tentacle::webroot::resolve;

static int failures = 0;
#define CHECK(cond)                                                          \
  do {                                                                       \
    if (!(cond)) {                                                           \
      std::fprintf(stderr, "ÉCHEC %s:%d : %s\n", __FILE__, __LINE__, #cond); \
      failures++;                                                            \
    }                                                                        \
  } while (0)

static void touch(const fs::path& p) {
  fs::create_directories(p.parent_path());
  std::ofstream(p) << "x";
}

int main() {
  const fs::path tmp = fs::temp_directory_path() / ("tentacle-web-root-" + std::to_string(::getpid()));
  const fs::path root = tmp / "web";
  touch(root / "index.html");
  touch(root / "assets" / "index-abc.js");
  touch(root / "avatars" / "pieuvre bleue.webp");
  touch(tmp / "web-evil" / "secret.txt");
  touch(tmp / "outside.txt");

  // Décodage
  CHECK(percentDecode("a%20b") == "a b");
  CHECK(percentDecode("%2e%2E/") == "../");
  CHECK(percentDecode("100%") == "100%");
  CHECK(percentDecode("%zz") == "%zz");

  // Fichiers servis tels quels
  auto r = resolve(root, "/assets/index-abc.js");
  CHECK(r.status == 200 && r.file == root / "assets" / "index-abc.js");
  r = resolve(root, "/avatars/pieuvre%20bleue.webp");
  CHECK(r.status == 200 && r.file == root / "avatars" / "pieuvre bleue.webp");

  // Application monopage : racine, routes, fichier absent → index.html
  CHECK(resolve(root, "/").file == root / "index.html");
  CHECK(resolve(root, "").file == root / "index.html");
  CHECK(resolve(root, "/settings/playback").file == root / "index.html");
  CHECK(resolve(root, "/assets/absent.js").file == root / "index.html");

  // Jamais d'API sous cette origine
  CHECK(resolve(root, "/api").status == 404);
  CHECK(resolve(root, "/api/config").status == 404);
  CHECK(resolve(root, "/apiculture").status == 200);

  // Confinement : ni `..`, ni encodé, ni voisin au nom préfixé
  CHECK(resolve(root, "/../outside.txt").status == 403);
  CHECK(resolve(root, "/%2e%2e/outside.txt").status == 403);
  CHECK(resolve(root, "/assets/../../outside.txt").status == 403);
  CHECK(resolve(root, "/../web-evil/secret.txt").status == 403);
  CHECK(resolve(root, "/a%00b.js").status == 403);
  CHECK(resolve(root, "/assets/../index.html").file == root / "index.html");

  // Sans index.html : 404, jamais autre chose
  fs::remove(root / "index.html");
  CHECK(resolve(root, "/route").status == 404);

  fs::remove_all(tmp);
  if (failures == 0) std::printf("web_root : tout passe\n");
  return failures;
}
