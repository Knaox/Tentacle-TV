#include "offline/glue/offline_shell.h"

#include <cstdio>

#include "app/app.h"
#include "offline/core/utf8_path.h"
#include "offline/glue/channels.h"
#include "offline/glue/engine_runtime.h"
#include "offline/glue/local_scheme.h"
#include "offline/glue/offline_thread.h"
#include "offline/glue/runtime.h"
#include "registry.h"
#include "shell/ipc.h"
#include "shell/paths.h"

namespace tentacle::offline {

void installInShell(bridge::Registry& registry, const AppContext& ctx) {
  thread::start();
  // Le dossier de données d'Electron (axe reseau : `--user-data`, sinon la règle de
  // `dataPaths.ts` sur les trois OS).
  const std::filesystem::path userData = paths::userData();
  // Le contexte se pose SUR le fil hors ligne : c'est le seul qui y touchera. Les évènements
  // partent par la plomberie du socle (sûre de tout fil, et qui survit au registre du pont,
  // refermé avant ce module) sous le nom que le shim attend (`tentacle:<évènement>`).
  thread::post([userData] {
    Runtime& rt = runtime();
    rt.userData = userData;
    rt.emit = [](const std::string& event, const Json& payload) {
      ipc::emit(std::string(bridge::Registry::kPrefix) + event, payload);
    };
  });
  registerSessionChannels(registry);
  // Stockage et lecture AVANT la liste : c'est `downloads_list` qui fait apparaître la
  // section côté page (ordre d'Electron ; ici les capacités sont figées d'un coup).
  registerStorageChannels(registry);
  registerPlaybackChannels(registry);
  registerMusicListChannels(registry);
  registerEngineChannels(registry);
  registerListChannels(registry);
  registry.event("downloads://progress");
  registry.event("downloads://changed");
  serveLocalScheme();
  installEngineRuntime();
  std::fprintf(stderr, "[offline] dossier de données : %s\n", pathToUtf8(userData).c_str());
}

void shutdown() {
  thread::stop([] {
    shutdownEngineRuntime();
    runtime().closeDb();
  });
}

}  // namespace tentacle::offline
