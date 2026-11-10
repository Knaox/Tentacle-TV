#pragma once
// `liquidGlass.sample(rects)` — `sampler.ts` d'Electron : la luminance relative médiane sous
// chaque rectangle de la page, pour que les surfaces de verre adaptent leurs glyphes au contenu.
//
// La PAGE : sa dernière image (celle que CEF vient de peindre), lue aux seuls points de la grille,
// hors du fil principal. Là où elle laisse voir le dessous, la VIDÉO (`glass_video.h`), composée
// SOUS la page point par point (`compositeOver`) — ce que l'œil voit, au verre natif près. Avec
// `under: "window"`, la vidéo SEULE : une capsule du lecteur ne mesure ni ses glyphes ni ses
// halos. Rien que des nombres repartent : jamais un pixel.
//
// Une mesure à la fois ; sur la vidéo, une par seconde au plus. Rien au repos : tout part d'un
// appel de la page.
//
// Fil : le fil principal.

#include <deque>
#include <functional>
#include <memory>
#include <optional>
#include <vector>

#include "glass/glass_video.h"
#include "glass/protocol.h"

struct SDL_Window;

namespace tentacle::glass {

using SampleResult = std::vector<std::optional<double>>;

class GlassSampler {
 public:
  GlassSampler(SDL_Window* window, Compositor* compositor) : window_(window), compositor_(compositor), video_(compositor) {}
  /// `rects` déjà validés (`parseSampleRects`) ; `done` sur le fil principal.
  void sample(std::vector<SampleRect> rects, std::function<void(SampleResult)> done);

 private:
  struct Job {
    std::vector<SampleRect> rects;
    std::function<void(SampleResult)> done;
  };
  void next();
  void measure(Job job);

  SDL_Window* window_;
  Compositor* compositor_;
  VideoGrabber video_;
  std::deque<Job> queue_;
  bool busy_ = false;
  std::shared_ptr<int> alive_ = std::make_shared<int>(0);
};

}  // namespace tentacle::glass
