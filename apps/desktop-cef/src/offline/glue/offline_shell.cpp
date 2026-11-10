#include "offline/glue/offline_shell.h"

#include <cstdio>

#include "app/app.h"
#include "offline/core/utf8_path.h"
#include "offline/glue/channels.h"
#include "offline/glue/offline_thread.h"
#include "offline/glue/runtime.h"
#include "offline/glue/user_data.h"
#include "registry.h"
#include "shell/ipc.h"

namespace tentacle::offline {

void installInShell(bridge::Registry& registry, const AppContext& ctx) {
  thread::start();
  const std::filesystem::path userData = resolveUserData(*ctx.options);
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
  std::fprintf(stderr, "[offline] dossier de données : %s\n", pathToUtf8(userData).c_str());
}

void shutdown() {
  thread::stop([] { runtime().closeDb(); });
}

}  // namespace tentacle::offline
