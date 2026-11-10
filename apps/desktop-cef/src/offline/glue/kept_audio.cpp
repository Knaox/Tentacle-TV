#include "offline/glue/kept_audio.h"

#include "offline/core/music.h"
#include "offline/glue/channels.h"
#include "offline/glue/offline_thread.h"
#include "offline/glue/runtime.h"
#include "shell/main_thread.h"

namespace tentacle::offline {

void keptAudioPath(std::string userId, std::string trackKey, std::function<void(std::optional<std::string>)> done) {
  thread::post([userId = std::move(userId), trackKey = std::move(trackKey), done = std::move(done)] {
    std::optional<std::string> path;
    try {
      Runtime& rt = runtime();
      path = music::keptAudioPath(rt.db(), rt.volume(), userId, trackKey, nowMs());
    } catch (...) {
      // Base ou racine indisponible : le serveur, comme si rien n'était gardé.
    }
    postToMain([done, path] { done(path); });
  });
}

}  // namespace tentacle::offline
