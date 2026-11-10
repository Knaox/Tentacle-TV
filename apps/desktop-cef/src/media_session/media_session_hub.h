// Le cœur de « À l'écoute » : deux sources (vidéo, musique), une session système.
// Portable et pur hormis les deux fonctions injectées (téléchargement de pochette,
// horloge) : testé seul (`tests/media_session_tests.cpp`).
//
// Règles :
// - une source n'est MONTRÉE qu'une fois réclamée ET décrite (un titre) ;
// - la source montrée est celle qui joue, la plus récente à s'être mise à jouer ; sinon la
//   dernière réclamée ; aucune → la session disparaît (touches rendues au système) ;
// - la position ne part vers l'OS que si elle s'écarte de ce qu'il extrapole (saut,
//   relecture) : le système fait avancer seul sa barre au rythme `rate` ;
// - la pochette est téléchargée par le cœur (jamais l'adresse authentifiée confiée à
//   l'OS), une fois par adresse, et ne s'applique que si le titre n'a pas changé entre-temps.
#pragma once

#include <array>
#include <deque>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "media_session/media_session.h"

namespace tentacle::media_session {

class Hub {
 public:
  using ArtworkDone = std::function<void(std::shared_ptr<const Artwork>)>;
  // Télécharge `url` ; `done` sur le fil principal (nullptr : échec). Jamais appelée en ligne
  // pour une adresse vide.
  using Fetch = std::function<void(const std::string& url, ArtworkDone done)>;
  using Clock = std::function<double()>;  // ms, monotone
  using Handler = std::function<void(const CommandEvent&)>;

  // Écart (ms) au-delà duquel une position est un SAUT et repart vers l'OS.
  static constexpr double kJumpMs = 1500;

  Hub(std::unique_ptr<Backend> backend, Fetch fetch, Clock clock);
  ~Hub();

  // La source se déclare ; `handler` reçoit les commandes du système quand elle est montrée.
  void claim(Kind kind, Handler handler);
  void release(Kind kind);
  void setNowPlaying(Kind kind, const NowPlaying& now);
  // `atMs` et `seeked` sont posés par le cœur : l'appelant donne l'état tel quel.
  void setPlayback(Kind kind, Playback playback);
  void setControls(Kind kind, const Controls& controls);
  void setAudioSessionName(const std::string& name);

  // Une commande du système (fil principal) : à la source montrée, sinon ignorée.
  void dispatch(const CommandEvent& event);

  std::optional<Kind> shown() const { return shown_; }
  // Une vraie couture d'OS (sinon : rien ne s'affiche, tout le reste tourne).
  bool hasBackend() const { return real_; }
  // Diagnostic (bancs) : ce que l'OS a reçu en dernier de la source montrée.
  struct Snapshot {
    std::optional<Kind> shown;
    NowPlaying now;
    Playback playback;
    Controls controls;
    bool artwork = false;
    size_t artworkBytes = 0;
  };
  Snapshot snapshot() const;

 private:
  struct Slot {
    bool claimed = false;
    Handler handler;
    std::optional<NowPlaying> now;
    Playback playback;  // le dernier reçu
    Playback sent;      // le dernier transmis à l'OS (montrée seulement)
    Controls controls;
    uint64_t claimSeq = 0;
    uint64_t playingSeq = 0;
    std::shared_ptr<const Artwork> artwork;
    std::string artworkFor;  // l'adresse dont `artwork` est la pochette (ou qu'on télécharge)
    uint64_t artworkGen = 0;
  };

  Slot& slot(Kind kind) { return slots_[kind == Kind::Music ? 0 : 1]; }
  const Slot& slot(Kind kind) const { return slots_[kind == Kind::Music ? 0 : 1]; }
  std::optional<Kind> elect() const;
  void recompute();
  void pushAll(Kind kind);
  void pushPlayback(Slot& s, bool seeked);
  void fetchArtwork(Kind kind);
  std::shared_ptr<const Artwork> cached(const std::string& url) const;
  void remember(const std::string& url, std::shared_ptr<const Artwork> artwork);

  std::unique_ptr<Backend> backend_;  // jamais nul (repli silencieux)
  bool real_ = false;
  Fetch fetch_;
  Clock clock_;
  std::array<Slot, 2> slots_;
  std::optional<Kind> shown_;
  uint64_t seq_ = 0;
  // Les dernières pochettes, par adresse : un album rejoué ne se retélécharge pas.
  std::deque<std::pair<std::string, std::shared_ptr<const Artwork>>> artworkCache_;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace tentacle::media_session
