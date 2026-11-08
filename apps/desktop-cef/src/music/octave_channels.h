// Octave — les canaux `audio_*` de Tentacle, branchés sur la plomberie IPC
// du socle (`registerHandler` / `emit`) sans dépendre de son en-tête : le
// socle passe deux fonctions. Le front de Tentacle n'a rien à changer : il
// voit `audio_play` dans `window.tentacle.capabilities` et prend le moteur mpv.
//
//   music::OctaveChannels octave(scheduler, makeBackend);
//   octave.install(registerHandler, emit);      // depuis src/app
//   octave.onVideoClaim();                      // une lecture vidéo démarre
#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "music/audio_backend.h"

namespace tentacle::music {

class AudioEngine;

class OctaveChannels {
 public:
  using Reply = std::function<void(nlohmann::json)>;
  using Fail = std::function<void(std::string code, std::string message)>;
  using Handler = std::function<void(const nlohmann::json& args, Reply reply, Fail fail)>;
  using Register = std::function<void(const std::string& channel, Handler handler)>;
  using Emit = std::function<void(const std::string& event, nlohmann::json payload)>;
  using BackendFactory = std::function<std::unique_ptr<AudioBackend>()>;

  static constexpr const char* kEvent = "audio://event";
  static const std::vector<std::string>& commands();

  // `extraOptions` : options mpv en plus (essais : `ao=null`, sortie PCM…).
  OctaveChannels(Scheduler& scheduler, BackendFactory makeBackend, Options extraOptions = {});
  ~OctaveChannels();

  void install(const Register& registerHandler, Emit emit);
  // Pour le faux natif : appeler une commande comme la page le ferait.
  void dispatch(const std::string& channel, const nlohmann::json& args, Reply reply, Fail fail);

  bool onVideoClaim();
  AudioEngine* engine() { return engine_.get(); }

 private:
  void start(const nlohmann::json& args, Reply reply, Fail fail);
  void stop(Reply reply);

  Scheduler& scheduler_;
  BackendFactory makeBackend_;
  Options extra_;
  Emit emit_;
  std::unique_ptr<AudioEngine> engine_;
  // Les moteurs en cours d'arrêt : gardés en vie jusqu'à leur `SHUTDOWN`.
  std::vector<std::unique_ptr<AudioEngine>> stopping_;
};

}  // namespace tentacle::music
