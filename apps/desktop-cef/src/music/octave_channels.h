// Octave — les canaux `audio_*` de Tentacle (`ipc/audio.ts` d'Electron), branchés sur la
// plomberie IPC du socle sans dépendre de son en-tête : le socle passe deux fonctions. Le
// front n'a rien à changer : il voit `audio_play` dans `window.tentacle.capabilities` et prend
// le moteur mpv.
//
// Trois gardes, comme Electron : arguments au schéma (`audio_types.cpp`) ; une SOURCE ne vient
// que du serveur réglé au démarrage, en http(s) (le jeton est posé sur ces requêtes) ; une
// copie gardée hors ligne est cherchée par la coquille (jamais un chemin donné par la page).
//
//   music::OctaveChannels octave(scheduler, makeBackend);
//   octave.install(registerHandler, emit);      // depuis src/app
#pragma once

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "music/audio_backend.h"
#include "music/audio_types.h"

namespace tentacle::music {

class CrossfadeDecks;

// Hors ligne (axe horsligne) : le fichier de la copie gardée de ce titre par ce compte, ou rien
// (la source du serveur sert alors). `trackKey` : celle de la copie (`kept.trackKey`) ou du titre.
using KeptLookup = std::function<std::optional<std::string>(const std::string& userId, const std::string& trackKey)>;

// Requêtes déléguées (axe reseau, `directSources.ts`) : adopte le flux direct d'une source
// (adresse du relais local) ou rend la source telle quelle, sur le fil principal.
struct DirectSession {
  std::string serverOrigin;
  std::map<std::string, std::string> headers;
};
using DirectAdopter = std::function<void(const Source& source, const std::string& trackKey, const DirectSession& session,
                                         std::function<void(Source)> done)>;

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

  // `extraOptions` : options mpv en plus (bancs : `ao=null`, sortie PCM…).
  OctaveChannels(Scheduler& scheduler, BackendFactory makeBackend, Options extraOptions = {});
  ~OctaveChannels();

  void install(const Register& registerHandler, Emit emit);
  // Pour le faux natif : appeler une commande comme la page le ferait.
  void dispatch(const std::string& channel, const nlohmann::json& args, Reply reply, Fail fail);

  void setKeptLookup(KeptLookup lookup) { kept_ = std::move(lookup); }
  void setDirectAdopter(DirectAdopter adopter) { direct_ = std::move(adopter); }

  // Une lecture VIDÉO démarre : la musique qui joue passe en pause (la page reçoit l'état et
  // `remote: pause`). Rend vrai si elle jouait.
  bool onVideoClaim();
  // Une commande du SYSTÈME : la page la reçoit en `{type:"remote", command}`.
  void emitRemote(const std::string& command);
  // Un geste natif (saut demandé par le système) : comme `audio_control`.
  void controlNative(const Control& c);
  // Le relais local dit un flux direct coupé : le titre est relu à la position.
  void sourceCut(const std::string& url);
  // À la fermeture de la fenêtre : la lecture s'arrête, la sortie est rendue (`stopAudio`).
  void stopAudio();
  void readProperty(const std::string& name, std::function<void(nlohmann::json)> done);
  CrossfadeDecks* engine() { return engine_.get(); }

 private:
  void start(const nlohmann::json& args, Reply reply, Fail fail);
  void stop(Reply reply);
  // La source qu'on confie à mpv : la copie gardée, ou la source du serveur (refus sinon),
  // éventuellement par le relais d'un flux direct.
  void checked(Source source, const std::string& trackKey, std::function<void(std::optional<std::string>, Source)> done);
  void emitEvent(const nlohmann::json& event);

  Scheduler& scheduler_;
  BackendFactory makeBackend_;
  Options extra_;
  Emit emit_;
  KeptLookup kept_;
  DirectAdopter direct_;
  std::unique_ptr<CrossfadeDecks> engine_;
  std::optional<std::string> serverOrigin_;
  std::map<std::string, std::string> serverHeaders_;
  std::string status_ = "idle";  // le dernier état émis (`onVideoClaim`)
  // Les moteurs en cours d'arrêt : gardés en vie jusqu'à leur `SHUTDOWN`.
  std::vector<std::unique_ptr<CrossfadeDecks>> stopping_;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::music
