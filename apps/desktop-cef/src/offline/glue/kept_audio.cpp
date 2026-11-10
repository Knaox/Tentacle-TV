#include "offline/glue/kept_audio.h"

#include <chrono>
#include <future>
#include <memory>

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

std::optional<std::string> keptAudioPathSync(const std::string& userId, const std::string& trackKey) {
  if (thread::current()) return std::nullopt;  // l'attendre ici ne finirait jamais
  auto answer = std::make_shared<std::promise<std::optional<std::string>>>();
  auto future = answer->get_future();
  thread::post([userId, trackKey, answer] {
    std::optional<std::string> path;
    try {
      Runtime& rt = runtime();
      path = music::keptAudioPath(rt.db(), rt.volume(), userId, trackKey, nowMs());
    } catch (...) {
    }
    answer->set_value(path);
  });
  if (future.wait_for(std::chrono::milliseconds(500)) != std::future_status::ready) return std::nullopt;
  return future.get();
}

}  // namespace tentacle::offline
