// « À l'écoute » et touches média — ce que le SYSTÈME montre de la lecture en cours et ce
// qu'il renvoie : macOS (Centre de contrôle, `MPNowPlayingInfoCenter`,
// `MPRemoteCommandCenter`), Windows (SMTC), Linux (MPRIS sur D-Bus).
//
// Deux sources, une seule session :
// - la VIDÉO, que le front décrit par les commandes `smtc_*` d'Electron (`useSmtc`) ;
// - la MUSIQUE (Octave), que le moteur natif décrit lui-même (titre, état, position).
// Le système n'en montre qu'UNE : celle qui joue, la plus récente à s'être mise à jouer ;
// sinon la dernière réclamée (`Hub::active`). Les commandes du système vont à elle seule.
//
// Ce fichier est PORTABLE (aucun en-tête d'OS) : le cœur (`Hub`) et la couture d'OS
// (`Backend`, une par système dans `src/platform/<os>/media_session_*`).
#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::media_session {

enum class Kind { Music, Video };
enum class Status { Stopped, Playing, Paused };

// Ce que le système affiche du titre.
struct NowPlaying {
  Kind kind = Kind::Music;
  std::string title;
  std::string artist;  // musique : les artistes ; vidéo : le sous-titre (série, S01E02)
  std::string album;
  // Adresse de la pochette (http(s), absolue) : le cœur la télécharge, jamais l'OS
  // (une adresse authentifiée ne sort pas du processus).
  std::string artworkUrl;
  bool operator==(const NowPlaying&) const = default;
};

// Une pochette téléchargée : les octets et leur type (`image/jpeg`, `image/png`…).
struct Artwork {
  std::vector<uint8_t> bytes;
  std::string mime;
};

// L'état de lecture : la position vaut à l'instant `atMs` (horloge monotone, ms) ; le
// système l'extrapole au rythme `rate` tant que `status` est `Playing`.
struct Playback {
  Status status = Status::Stopped;
  double positionMs = 0;
  std::optional<double> durationMs;
  double rate = 1.0;
  double atMs = 0;
  // La position a SAUTÉ (saut, titre relu) : MPRIS émet `Seeked`, les autres recalent.
  bool seeked = false;
};

// Les commandes que le système peut proposer.
struct Controls {
  bool next = false;
  bool previous = false;
  bool seek = false;  // « changer la position » (barre du Centre de contrôle, MPRIS SetPosition)
  bool operator==(const Controls&) const = default;
};

enum class Command { Play, Pause, Toggle, Stop, Next, Previous, Seek };

struct CommandEvent {
  Command command = Command::Toggle;
  double positionMs = 0;  // `Seek` : position ABSOLUE visée
};

// La couture d'OS. Toutes les méthodes sont appelées sur le fil principal ; l'OS peut,
// lui, rappeler `BackendHost::onCommand` depuis n'importe quel fil.
class Backend {
 public:
  virtual ~Backend() = default;
  // Une source a quelque chose à montrer : le système affiche la session, les touches
  // média viennent à nous. Appelée avant le premier `set*` d'une session.
  virtual void activate() = 0;
  // Plus rien à montrer : la session disparaît, les touches sont RENDUES au système
  // (sinon Tentacle volerait « lecture » à une autre application).
  virtual void deactivate() = 0;
  // `artwork` : nullptr tant que la pochette n'est pas là (ou s'il n'y en a pas).
  virtual void setNowPlaying(const NowPlaying& now, std::shared_ptr<const Artwork> artwork) = 0;
  virtual void setPlayback(const Playback& playback) = 0;
  virtual void setControls(const Controls& controls) = 0;
  // Windows : nom de la session audio du processus dans le mélangeur (`set_audio_session_name`).
  virtual void setAudioSessionName(const std::string& /*name*/) {}
  // Diagnostic des bancs : ce que l'OS tient RÉELLEMENT (relu chez lui), en JSON ; "null" sinon.
  virtual std::string debugState() const { return "null"; }
};

struct BackendHost {
  // Une commande du système ; appelable depuis N'IMPORTE QUEL fil (la colle repasse sur
  // le fil principal).
  std::function<void(CommandEvent)> onCommand;
  // La fenêtre principale SDL3 (`SDL_Window*`), pour l'OS qui y rattache la session (Windows).
  void* sdlWindow = nullptr;
  // Nom montré par le système (MPRIS `Identity`), et fichier .desktop (MPRIS `DesktopEntry`).
  std::string identity = "Tentacle";
  std::string desktopEntry = "com.tentacle.media";
};

// Défini dans `src/platform/<os>/media_session_<os>.*`. Rend nullptr si l'OS ne peut pas
// (pas de bus de session, API absente) : tout reste silencieux, rien ne casse.
std::unique_ptr<Backend> createBackend(const BackendHost& host);

}  // namespace tentacle::media_session
