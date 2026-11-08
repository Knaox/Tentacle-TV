// Octave — le cœur mpv de la musique sur le `Player` de vidéo-HDR, en AUDIO
// SEUL (`audioOnly` : `vid=no`, `audio-display=no`, `attachVideoSurface`
// refusée ⇒ aucune couche Metal, jamais). Une instance à part de celle de la
// vidéo, sur la même libmpv (le fork), comme Tentacle.
#pragma once

#include <memory>

#include "music/audio_backend.h"

namespace tentacle {
class Player;
}

namespace tentacle::music {

class PlayerAudioBackend final : public AudioBackend {
 public:
  explicit PlayerAudioBackend(Scheduler& scheduler);
  ~PlayerAudioBackend() override;

  std::optional<std::string> start(const Options& options, const Observed& observed,
                                   BackendEvents events) override;
  bool running() const override;
  void command(std::vector<std::string> args, Done done) override;
  void getProperty(const std::string& name, std::function<void(nlohmann::json)> done) override;
  void destroy(std::function<void()> done) override;

 private:
  Scheduler& scheduler_;
  std::unique_ptr<Player> player_;
};

}  // namespace tentacle::music
