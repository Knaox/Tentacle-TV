// `PlayerPort` sur le vrai lecteur de vidéo-HDR (`src/player/player.h`).
//
// Une instance `Player` par lecture (`mpv_init` → `mpv_destroy`), comme Electron. La
// surface vidéo (notre CAMetalLayer) naît au PREMIER `loadfile`, pas à l'init : le
// compositeur de macOS accorde le headroom EDR à la naissance de la couche et n'y
// revient pas (fait mesuré par Tentacle, rappelé par `createVideoSurface`). Elle est
// rangée sous la page par le compositeur du socle, plein cadre, et suit la fenêtre.
#pragma once

#include <memory>
#include <string>
#include <vector>

#include "ports.h"

struct SDL_Window;

namespace tentacle {
class Compositor;
class Player;
class VideoSurface;
}  // namespace tentacle

namespace bridge {

class MpvPlayerPort : public PlayerPort {
 public:
  /// `restingLayer` : la couche à rendre sous la page quand aucune vidéo ne joue (la
  /// couche factice du socle, ou nullptr).
  MpvPlayerPort(SDL_Window* window, void* nativeWindow, tentacle::Compositor* compositor,
                tentacle::VideoSurface* restingLayer);
  ~MpvPlayerPort() override;

  void start(const Json& options, Done done) override;
  void stop(std::function<void()> done) override;
  bool running() const override;
  void command(const Json& args, Done done) override;
  void setProperty(const std::string& name, const Json& value, Done done) override;
  void getProperty(const std::string& name, std::function<void(std::optional<Json>)> done) override;
  void observe(const std::string& name, const std::string& format) override;
  void setListener(PlayerListener* listener) override { listener_ = listener; }

  /// Diagnostic : la couche vidéo telle que le système la voit (`null` sans surface).
  Json surfaceState() const;

  /// La fenêtre a changé de taille (points) : la surface suit, plein cadre.
  void windowResized(double widthPt, double heightPt);

 private:
  bool ensureSurface(std::string* error);

  struct Dying {  // une instance qui s'arrête, et la couche qu'elle tient encore
    std::unique_ptr<tentacle::Player> player;
    std::unique_ptr<tentacle::VideoSurface> surface;
  };
  std::vector<std::shared_ptr<Dying>> dying_;

  SDL_Window* window_;
  void* nativeWindow_;
  tentacle::Compositor* compositor_;
  tentacle::VideoSurface* restingLayer_;
  std::unique_ptr<tentacle::Player> player_;
  std::unique_ptr<tentacle::VideoSurface> surface_;
  PlayerListener* listener_ = nullptr;
  double widthPt_ = 0, heightPt_ = 0;
  // Génération de l'instance : un rappel d'une instance arrêtée est ignoré.
  std::shared_ptr<int> generation_ = std::make_shared<int>(0);
};

}  // namespace bridge
