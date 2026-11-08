// Octave — le moteur audio NATIF : l'instance mpv de la musique, sa liste
// [en cours, (suivant)] et l'état poussé vers la page. Port C++ du moteur de
// Tentacle (`audioEngine.ts`, `audioQueue.ts`, `audioEngineState.ts`), sans
// fondu enchaîné, sortie exclusive, bascule à chaud ni fichier qui grandit.
//
// La FILE vit dans la page ; le moteur ne connaît que le titre COURANT et le
// SUIVANT : le suivant est ajouté à la liste de mpv (`prefetch-playlist`,
// `gapless-audio=weak`) et mpv enchaîne seul, sans aller-retour IPC — le
// départ du suivant (`START_FILE`) devient l'évènement `advanced`.
#pragma once

#include <chrono>
#include <functional>
#include <memory>
#include <optional>
#include <set>
#include <string>

#include "music/audio_backend.h"
#include "music/audio_options.h"
#include "music/audio_types.h"

namespace tentacle::music {

class AudioEngine {
 public:
  using Emit = std::function<void(nlohmann::json event)>;  // charge de `audio://event`

  AudioEngine(Scheduler& scheduler, std::unique_ptr<AudioBackend> backend, Emit emit, Options extra = {});
  ~AudioEngine();

  using StartDone = std::function<void(std::optional<std::string> error, nlohmann::json capabilities)>;
  void start(const StartSettings& settings, StartDone done);
  const std::string& serverOrigin() const { return settings_.serverOrigin; }

  void play(const Track& track, const Source& source, double startMs);
  void setNext(const std::optional<Track>& track, const std::optional<Source>& source);
  void swap(const std::string& trackKey, const Source& source);
  // `{action: pause|resume|stop|seek|volume|muted|replayGain|crossfade, value?, mode?}`.
  std::optional<std::string> control(const nlohmann::json& c);
  void listOutputs(std::function<void(nlohmann::json)> done);
  void setOutput(const std::optional<std::string>& deviceId, std::function<void(std::optional<std::string>)> done);
  void dispose(std::function<void()> done);

  // Une lecture VIDÉO démarre : la musique qui joue passe en pause (l'état et
  // une commande système `pause` partent vers la page). Rend vrai si elle jouait.
  bool onVideoClaim();

  // Un moteur qui s'arrête ne parle plus à la page (un plus récent peut être né).
  void detachEmit() { emit_ = [](nlohmann::json) {}; }

  BridgeState state() const;
  // Diagnostic et preuves (faux natif) : une propriété mpv en nœud JSON.
  void readProperty(const std::string& name, std::function<void(nlohmann::json)> done);

  struct Entry {
    int64_t mpvId = -1;  // connu à la réponse de `loadfile`
    bool advance = false;
    Track track;
    Source source;
    double startS = 0;
    std::optional<std::string> fromKey;
  };

 private:
  struct Props {
    std::optional<double> timePos, sampleRate, channels, bitrate, duration;
    std::optional<std::string> codec, fileFormat;
    bool eofReached = false;
    bool pausedForCache = false;
  };
  struct Flags {
    bool wantPaused = false;
    bool awaitingRestart = false;
    // Le suivant s'ouvre (enchaînement sans blanc) : pas « loading », mais un seek attend.
    bool opening = false;
    bool ended = false;
    std::optional<std::string> error;
  };

  void onProperty(const std::string& name, const PropValue& value);
  void onStartFile(int64_t id);
  void onEndFile(int64_t id, int reason, int error);
  void load(std::shared_ptr<Entry> entry, bool replace);
  void seekTo(double seconds);
  void fail(const std::string& message, const Entry& entry);
  void emitEvent(nlohmann::json event);
  void emitState(bool throttled = false);
  void sendState();
  std::string status() const;

  Scheduler& scheduler_;
  std::unique_ptr<AudioBackend> backend_;
  Emit emit_;
  Options extra_;
  StartSettings settings_;
  std::shared_ptr<Entry> current_, next_;
  std::set<int64_t> earlyStarts_;
  // Un seek demandé pendant l'ouverture d'un fichier (mpv le refuse : lecture
  // pas encore initialisée) : rejoué au `playback-restart` suivant.
  std::optional<double> pendingSeekS_;  // `START_FILE` arrivés avant la réponse de leur `loadfile`
  Props props_;
  Flags flags_;
  // L'état part au plus 4 fois par seconde pour la position, tout de suite sinon.
  std::chrono::steady_clock::time_point lastState_{};
  bool statePending_ = false;
  nlohmann::json lastSent_;  // un état identique au précédent ne repart pas
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::music
