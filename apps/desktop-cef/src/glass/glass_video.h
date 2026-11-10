#pragma once
// La vidéo SOUS la page, pour `liquidGlass.sample` — `videoSample.ts` d'Electron : l'image que
// mpv a décodée, demandée à mpv lui-même (`screenshot-raw video bgra`) et lue aux seuls points
// de la grille de chaque rectangle (`video_layout.h`), EN PLACE dans la réponse
// (`Player::commandReading`) : jamais l'image recopiée.
//
// Pourquoi mpv et pas une capture du système (mesuré par Electron le 22/10) : une capture de
// fenêtre est vide ou exige l'autorisation « Enregistrement de l'écran ». mpv sait rendre
// l'image qu'il montre, ramenée en sRGB (HDR compris), sans rien de privé.
//
// Le coût : la capture logicielle de mpv (25 à 82 ms sur SON cœur, mesuré par Electron), la
// commande est asynchrone. Une capture à la fois, une par seconde au plus ; rien au repos.
// Sous CEF la vidéo est notre couche, sous la page (`Compositor::shownVideoFrame`) ; prêtée au
// PiP, elle n'est plus sous cette page : rien.
//
// Fil : le fil principal.

#include <deque>
#include <functional>
#include <memory>
#include <optional>
#include <vector>

#include "glass/glass_platform.h"

namespace tentacle::glass {

class VideoGrabber {
 public:
  explicit VideoGrabber(Compositor* compositor) : compositor_(compositor) {}
  /// La grille de la vidéo sous chaque boîte (points de la vue) ; `nullopt` en tout s'il n'y a
  /// pas de vidéo sous la page ou si mpv n'a pas d'image à rendre (ouverture, recherche).
  void grab(std::vector<std::optional<Box>> boxes, std::function<void(std::optional<platform::Grids>)> done);

 private:
  struct Job {
    std::vector<std::optional<Box>> boxes;
    std::function<void(std::optional<platform::Grids>)> done;
  };
  void next();
  void shoot(Job job);

  Compositor* compositor_;
  std::deque<Job> queue_;
  bool busy_ = false;
  double lastShotMs_ = -1e12;
  /// Les rappels en vol (minuteurs, mpv) survivent au module : ils ne touchent plus rien ensuite.
  std::shared_ptr<int> alive_ = std::make_shared<int>(0);
};

}  // namespace tentacle::glass
