// Octave — le cœur mpv de la musique sur libmpv DIRECT : une instance à part,
// sans surface ni sortie vidéo (le choix de Tentacle, `audioMpv.ts`). Sert tant
// que l'API `Player` de vidéo-HDR n'est pas intégrée, et aux essais du faux natif.
#pragma once

#include <memory>

#include "music/audio_backend.h"

namespace tentacle::music {

class MpvAudioBackend final : public AudioBackend {
 public:
  explicit MpvAudioBackend(Scheduler& scheduler);
  ~MpvAudioBackend() override;

  std::optional<std::string> start(const Options& options, const Observed& observed,
                                   BackendEvents events) override;
  bool running() const override;
  void command(std::vector<std::string> args, Done done) override;
  void getProperty(const std::string& name, std::function<void(nlohmann::json)> done) override;
  void destroy(std::function<void()> done) override;

  struct Impl;

 private:
  std::shared_ptr<Impl> impl_;
};

}  // namespace tentacle::music
