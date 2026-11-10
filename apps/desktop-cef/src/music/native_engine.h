// Octave — le moteur audio NATIF, une instance mpv : port de `audioEngine.ts` d'Electron.
// La liste (`AudioQueue`), l'état poussé vers la page, la bascule à l'instant T, la fin
// provisoire d'un fichier qui grandit, la coupure, le préchauffage de la sortie, la mesure du
// niveau. Tout se décide sur les évènements de mpv, sans l'aller-retour de l'IPC ; aucune
// méthode n'attend le son.
#pragma once

#include <chrono>
#include <map>
#include <memory>
#include <optional>
#include <string>

#include "music/audio_backend.h"
#include "music/audio_options.h"
#include "music/deck.h"
#include "music/engine_ends.h"
#include "music/timers.h"

namespace tentacle::music {

struct EngineConfig {
  Platform platform = currentPlatform();
  double leadS = 1.5;          // avance du point de bascule, au-delà du tampon de la sortie
  Options extraOptions;        // options en plus (bancs : sortie PCM, `ao=null`)
  bool warmOutput = true;      // préchauffer la sortie à la naissance (`outputWarmup.ts`)
};

// La commande du préchauffage (`warmupArgs` d'Electron), testée seule.
std::vector<std::string> warmupArgs();

class NativeAudioEngine final : public Deck {
 public:
  NativeAudioEngine(Scheduler& scheduler, std::unique_ptr<AudioBackend> backend, EngineConfig config, DeckEmit emit);
  ~NativeAudioEngine() override;

  void start(const StartSettings& start, StartDone done) override;
  void play(const Track& track, const Source& source, double startMs, bool paused = false) override;
  void setNext(const std::optional<Track>& track, const std::optional<Source>& source) override;
  void swap(const std::string& trackKey, const Source& source) override;
  void control(const Control& c) override;
  void listOutputs(std::function<void(nlohmann::json)> done) override;
  void setOutput(const std::optional<std::string>& deviceId, bool exclusive, Done done) override;
  void setChain(const std::optional<std::string>& expr) override;
  void setGain(const std::string& expr) override;
  DeckTimeline timeline() const override;
  void sourceCut(const std::string& url) override { ends_.sourceCut(url); }
  void level(std::function<void(std::optional<double>)> done) override;
  void readProperty(const std::string& name, std::function<void(nlohmann::json)> done) override;
  void dispose(std::function<void()> done) override;

 private:
  void run(QueueResult result);
  void fail(const std::string& message, const std::string& trackKey, const Source& source);
  void onProperty(const std::string& name, const PropValue& value);
  void onStartFile(int64_t mpvId);
  void seekTo(double seconds);
  double positionS() const;
  void checkExpiry(const std::string& trackKey, const Source& source);
  void warmOutput();
  void command(std::vector<std::string> args, AudioBackend::Done done = {});
  void setProp(const std::string& name, const std::string& value) { command({"set", name, value}); }
  void emitState(bool throttled = false);
  void flushState();

  Scheduler& scheduler_;
  std::unique_ptr<AudioBackend> backend_;
  EngineConfig config_;
  DeckEmit emit_;
  Timers timers_;
  AudioQueue queue_;
  LiveProps props_;
  EngineFlags flags_ = freshFlags(false);
  Settings settings_;
  std::map<std::string, Source> overrides_;  // bascules reçues pour un titre ni courant ni suivant
  FileEnds ends_;
  std::optional<double> swapAtS_;
  // Acquis du proto CEF (banc d'Octave) : un saut pendant l'OUVERTURE d'un fichier (le suivant
  // qui vient de partir, avant `playback-restart`) figeait la lecture de mpv ; il attend la fin
  // de l'ouverture. Electron n'en a pas besoin (le cas ne s'y présente pas) : rien de visible ne change.
  bool opening_ = false;
  std::optional<double> pendingSeekS_;
  int64_t warmId_ = -1;
  // L'état part au plus quatre fois par seconde pour la position, regroupé sinon.
  std::chrono::steady_clock::time_point lastState_{};
  Timers::Id stateTimer_ = 0;
  bool stateQueued_ = false;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::music
