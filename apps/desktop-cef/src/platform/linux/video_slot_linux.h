#pragma once
// La place de la vidéo dans une pile de couches Linux (compositor_linux.cpp) : la couche montrée
// ici, son cadre — plein cadre, ou à `inset` points des bords dans la pile du PiP — et le PRÊT de
// la couche à la pile d'une autre fenêtre (Compositor::lendVideo, src/pip), sur le modèle de
// compositor_mac.mm : la MÊME couche, sans nouvelle sortie de mpv. Le cadre est l'affaire de la
// pile seule (le pont ne recadre plus, mpv_player_port.cpp). Fil principal.

#include "platform/linux/video_layer_linux.h"
#include "platform/video_surface.h"

struct SDL_Window;

namespace tentacle {
class Compositor;
}

namespace tentacle::platform {

class VideoSlot {
 public:
  VideoSlot(SDL_Window* window, GlHost* gl);
  ~VideoSlot();
  VideoSlot(const VideoSlot&) = delete;
  VideoSlot& operator=(const VideoSlot&) = delete;

  // Compositor::setVideoLayer : prêtée, une vraie couche part chez l'emprunteur ; la couche du
  // repos (`home`) reste ici.
  void set(VideoSurface* surface);
  // `borrower` vit jusqu'à reclaim().
  void lend(Compositor* borrower, VideoSurface* home);
  void reclaim();
  void setInset(double inset);
  // La fenêtre a changé de taille (ou d'échelle) : la couche montrée suit.
  void resized();

  // Ce que CETTE pile montre (nullptr : rien, ou la couche est prêtée).
  VideoSurface* shown() const { return shown_; }
  LinuxVideoLayer* layer() const;
  bool lent() const { return borrower_ != nullptr; }
  // Le cadre de la vidéo dans la fenêtre, en DIP.
  RectPt frame() const;

 private:
  void attach(VideoSurface* surface);
  void detach(VideoSurface* surface);

  SDL_Window* window_;
  VideoHost host_;
  VideoSurface* video_ = nullptr;  // la couche de cette pile, même prêtée
  VideoSurface* shown_ = nullptr;  // celle qu'elle montre
  VideoSurface* home_ = nullptr;
  Compositor* borrower_ = nullptr;
  double inset_ = 0;
};

}  // namespace tentacle::platform
