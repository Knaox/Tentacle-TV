// Tire l'implémentation système ENTIÈRE dans un exécutable : tous ses appels au système (WinHTTP,
// shell32, kernel32 ; libcurl) sont résolus au lien. Lancé, il dit ce que voit cet appareil.
#include <cstdio>
#include <filesystem>

#include "update/system.h"

int main() {
  using namespace tentacle::update;
  SystemHooks hooks;
  hooks.post = [](std::function<void()> fn) { fn(); };
  hooks.postDelayed = [](int64_t, std::function<void()> fn) { fn(); };
  hooks.quit = [] {};
  hooks.stateDir = (std::filesystem::temp_directory_path() / "tentacle-update-system-check").string();
  auto p = createSystemPlatform(hooks);
  std::string why;
  const bool self = p->canSelfUpdate(&why);
  std::printf("système : %s, version %s, se met à jour seule : %s\n", p->platformKey().c_str(),
              p->currentVersion() ? p->currentVersion()->str().c_str() : "?", self ? "oui" : why.c_str());
  std::filesystem::remove_all(hooks.stateDir);
  return 0;
}
