// Ce qu'une lecture VIDÉO donne à voir à un module qui doit l'accompagner — aujourd'hui le HDR
// de l'écran (src/display : sous Windows, bascule de l'écran et `target-colorspace-hint`,
// comme `hdrSession.ts` d'Electron). Tout se passe sur le fil principal.
//
// Branchement (src/app/modules.cpp) : `pont::setVideoSessionObserver(&observateur)` entre
// `pont::install` et `pont::installShim`.
#pragma once

#include <functional>
#include <optional>
#include <string>

#include "ports.h"

namespace tentacle::pont {

// Le lecteur de la lecture en cours, prêté le temps d'un rappel ou gardé : chaque appel est
// sans effet une fois cette instance arrêtée (épisode suivant, `mpv_destroy`).
struct VideoSessionAccess {
  std::function<void(const std::string& name, std::function<void(std::optional<bridge::Json>)> done)> get;
  std::function<void(const std::string& name, const bridge::Json& value)> set;
};

class VideoSessionObserver {
 public:
  virtual ~VideoSessionObserver() = default;
  // `file-loaded` et `video-reconfig` de mpv (les paramètres vidéo n'existent qu'au second).
  virtual void onVideoEvent(const std::string& event, const VideoSessionAccess& player) = 0;
  // L'instance s'arrête (`mpv_destroy`, ou remplacée par la suivante) — avant sa destruction.
  virtual void onVideoStopped() = 0;
};

void setVideoSessionObserver(VideoSessionObserver* observer);

}  // namespace tentacle::pont
