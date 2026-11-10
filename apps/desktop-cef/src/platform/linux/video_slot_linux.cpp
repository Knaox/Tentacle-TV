#include "platform/linux/video_slot_linux.h"

#include <algorithm>

#include "compositor/compositor.h"
#include "platform/linux/linux_window.h"
#include "shell/window_scale.h"

namespace tentacle::platform {

VideoSlot::VideoSlot(SDL_Window* window, GlHost* gl) : window_(window), host_{linuxWindow(window), gl} {}

VideoSlot::~VideoSlot() {
  // La couche survit à la pile (fermeture du PiP) : elle n'adresse plus ses dessins ici.
  if (shown_) shown_->setHostWindow(nullptr);
}

void VideoSlot::set(VideoSurface* surface) {
  if (borrower_) {
    const bool lend = surface && surface != home_;
    if (!lend) borrower_->setVideoLayer(nullptr);
    if (shown_) detach(shown_);
    video_ = surface;
    if (lend) {
      borrower_->setVideoLayer(surface);
    } else if (surface) {
      attach(surface);
    }
    return;
  }
  if (video_) detach(video_);
  video_ = surface;
  if (video_) attach(video_);
}

void VideoSlot::lend(Compositor* borrower, VideoSurface* home) {
  borrower_ = borrower;
  home_ = home;
  if (video_ && video_ != home_) {
    detach(video_);
    borrower_->setVideoLayer(video_);  // la MÊME couche : mpv y dessine sans le savoir
  }
}

void VideoSlot::reclaim() {
  if (!borrower_) return;
  borrower_->setVideoLayer(nullptr);
  borrower_ = nullptr;
  home_ = nullptr;
  if (shown_) detach(shown_);
  if (video_) attach(video_);
}

void VideoSlot::setInset(double inset) {
  inset_ = std::max(0.0, inset);
  resized();
}

void VideoSlot::resized() {
  if (shown_) shown_->setFrame(frame());
}

LinuxVideoLayer* VideoSlot::layer() const {
  return shown_ ? static_cast<LinuxVideoLayer*>(shown_->nativeLayer()) : nullptr;
}

RectPt VideoSlot::frame() const {
  int w = 0, h = 0;
  windowSizeDip(window_, w, h);
  return {inset_, inset_, std::max(1.0, w - 2 * inset_), std::max(1.0, h - 2 * inset_)};
}

void VideoSlot::attach(VideoSurface* surface) {
  // Fenêtre (échelle ; parent de la sous-surface) et dessins de CETTE pile, puis son cadre.
  surface->setHostWindow(&host_);
  surface->setFrame(frame());
  surface->show();
  shown_ = surface;
}

void VideoSlot::detach(VideoSurface* surface) {
  if (shown_ != surface) return;
  surface->setHostWindow(nullptr);  // dessins : la fenêtre principale, jusqu'à une autre pile
  shown_ = nullptr;
}

}  // namespace tentacle::platform
