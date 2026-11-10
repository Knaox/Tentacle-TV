// Octave — le cœur mpv vu par le moteur musique : une petite interface, pour
// coder le mode musique sans dépendre de l'API `Player` de vidéo-HDR tant
// qu'elle n'est pas livrée (`mpv_audio_backend` : libmpv direct), puis
// l'adapter à `Player` sans rien changer au moteur.
//
// Règles (communes à tout le lot) :
// - tout est ASYNCHRONE (commandes, lectures) : jamais d'appel mpv synchrone
//   depuis le fil principal ni depuis un rappel d'évènement mpv ;
// - les rappels arrivent sur le fil principal (celui du `Scheduler`).
#pragma once

#include <chrono>
#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include <nlohmann/json.hpp>

namespace tentacle::music {

// Le fil principal : `post` est appelable depuis n'importe quel fil ;
// `postDelayed` depuis le fil principal.
class Scheduler {
 public:
  virtual ~Scheduler() = default;
  virtual void post(std::function<void()> task) = 0;
  virtual void postDelayed(int delayMs, std::function<void()> task) = 0;
  // Horloge monotone (ms) : celle des minuteries — les bancs la remplacent par un temps virtuel.
  virtual double nowMs() const {
    using namespace std::chrono;
    return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
  }
};

enum class PropFormat { Flag, Int64, Double, String };

using PropValue = std::variant<std::monostate, bool, int64_t, double, std::string>;

struct BackendEvents {
  std::function<void(const std::string& name, const PropValue& value)> property;
  std::function<void(int64_t entryId)> startFile;
  // Raisons de `MPV_EVENT_END_FILE` (`client.h`) : 0 EOF, 2 STOP, 3 QUIT, 4 ERROR, 5 REDIRECT.
  std::function<void(int64_t entryId, int reason, int error)> endFile;
  std::function<void()> playbackRestart;
};

using Observed = std::vector<std::pair<std::string, PropFormat>>;
using Options = std::vector<std::pair<std::string, std::string>>;

class AudioBackend {
 public:
  virtual ~AudioBackend() = default;

  // Crée et initialise le cœur. Rend le motif d'un échec, sinon rien.
  virtual std::optional<std::string> start(const Options& options, const Observed& observed,
                                           BackendEvents events) = 0;
  virtual bool running() const = 0;

  // Une commande mpv ; `done(erreur, résultat)` à sa réponse (le résultat :
  // `{"playlist_entry_id": n}` pour `loadfile`).
  using Done = std::function<void(std::optional<std::string> error, const nlohmann::json& result)>;
  virtual void command(std::vector<std::string> args, Done done = {}) = 0;

  // Lecture d'une propriété en nœud JSON (`null` si absente).
  virtual void getProperty(const std::string& name, std::function<void(nlohmann::json)> done) = 0;

  // Arrête le cœur (`quit` asynchrone), le libère à `MPV_EVENT_SHUTDOWN`, puis `done`.
  virtual void destroy(std::function<void()> done) = 0;
};

}  // namespace tentacle::music
