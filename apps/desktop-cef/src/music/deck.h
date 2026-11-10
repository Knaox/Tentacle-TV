// Octave — une INSTANCE du moteur audio (un « deck ») vue par la transition douce : l'interface
// de `NativeAudioEngine` dont `CrossfadeDecks` a besoin. Une interface pour que la transition
// se teste avec de fausses instances (`tests/crossfade_decks_tests.cpp`), comme le
// `vi.mock("./audioEngine")` d'Electron.
#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

#include "music/audio_types.h"
#include "music/crossfade_rules.h"

namespace tentacle::music {

class Deck {
 public:
  virtual ~Deck() = default;
  using StartDone = std::function<void(std::optional<std::string> error, nlohmann::json capabilities)>;
  using Done = std::function<void(std::optional<std::string> error)>;

  virtual void start(const StartSettings& start, StartDone done) = 0;
  // `paused` : chargé sans jouer (le titre qui arrive d'un fondu, lancé par `resume`).
  virtual void play(const Track& track, const Source& source, double startMs, bool paused = false) = 0;
  virtual void setNext(const std::optional<Track>& track, const std::optional<Source>& source) = 0;
  virtual void swap(const std::string& trackKey, const Source& source) = 0;
  virtual void control(const Control& c) = 0;
  virtual void listOutputs(std::function<void(nlohmann::json)> done) = 0;
  virtual void setOutput(const std::optional<std::string>& deviceId, bool exclusive, Done done) = 0;
  // La chaîne `af`, avec le gain du fondu (`expr` à sa naissance) ou sans : instance au repos.
  virtual void setChain(const std::optional<std::string>& expr) = 0;
  // Le gain du fondu pendant la lecture (`af-command`, sans reconstruire la chaîne).
  virtual void setGain(const std::string& expr) = 0;
  virtual DeckTimeline timeline() const = 0;
  virtual void sourceCut(const std::string& url) = 0;
  virtual void level(std::function<void(std::optional<double>)> done) = 0;
  virtual void readProperty(const std::string& name, std::function<void(nlohmann::json)> done) = 0;
  // Arrête l'instance (`quit`) et libère la sortie ; `done` quand c'est fait.
  virtual void dispose(std::function<void()> done) = 0;
};

using DeckEmit = std::function<void(const nlohmann::json& event)>;
using DeckFactory = std::function<std::unique_ptr<Deck>(DeckEmit emit)>;

}  // namespace tentacle::music
