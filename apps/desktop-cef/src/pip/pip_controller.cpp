#include "pip/pip_controller.h"

#include <cstdio>

#include "compositor/compositor.h"
#include "pip/rules/pip_captions.h"

namespace tentacle::pip {

Controller::Controller(Platform& platform, Compositor* video, VideoSurface* home, Frame frame)
    : platform_(platform), video_(video), home_(home), frame_(frame) {}

Controller::~Controller() {
  // Filet : la vidéo ne reste jamais prêtée à une pile qui disparaît.
  releaseVideo();
  session_.reset();
  window_.reset();
}

Frame Controller::arm(Mode mode, double width, double height) {
  arming_.arm(mode, width, height, platform_.ticker().nowMs());
  return frame_;
}

OpenDecision Controller::decide(const std::string& frameName, const std::string& url) {
  const bool open = page_ != nullptr || pending_.has_value();
  OpenDecision d = arming_.decide(frameName, url, platform_.ticker().nowMs(), open, frame_);
  if (d.kind == OpenDecision::Kind::allow) pending_ = d;
  if (d.kind == OpenDecision::Kind::deny) std::fprintf(stderr, "[pip] fenêtre PiP refusée\n");
  return d;
}

void Controller::popupCreated(std::unique_ptr<Page> page, PageInput input) {
  if (!pending_ || page_) {  // jamais : le filtre n'en accepte qu'une
    page->close();
    return;
  }
  const OpenDecision d = *pending_;
  pending_.reset();
  page_ = std::move(page);
  mode_ = d.mode;
  closing_ = false;
  const Box placeholder{0, 0, d.window.width, d.window.height};
  window_ = platform_.createWindow(placeholder, d.mode, caption(d.mode, std::nullopt),
                                   std::move(input));
  if (!window_) {
    std::fprintf(stderr, "[pip] fenêtre native impossible : PiP refermé\n");
    page_->close();
    return;
  }
  if (Compositor* pipStack = window_->compositor()) pipStack->setVideoInset(frame_.inset());
  // Placé AVANT d'être montré, sur l'image du lecteur : jamais un PiP — ni une image — qui
  // saute de place. La vidéo y passe dans le même tour, puis la fenêtre paraît.
  session_ = std::make_unique<Session>(*window_, platform_.desktop(), platform_.ticker(), frame_,
                                       d.mode, d.aspect);
  if (video_ && window_->compositor()) lent_ = video_->lendVideo(window_->compositor(), home_);
  page_->geometryChanged();
  window_->showInactive();
  session_->enter();
}

bool Controller::setMode(Mode mode, std::optional<Size> video) {
  if (!session_) return false;
  mode_ = mode;
  window_->setCaption(caption(mode, std::nullopt));
  session_->setMode(mode, video);
  return true;
}

bool Controller::resize(double width, double height) {
  if (!session_) return false;
  session_->resize(width, height);
  return true;
}

bool Controller::setGesture(std::optional<Gesture> gesture, std::optional<Point> grab) {
  if (!session_) return false;
  session_->setGesture(gesture, grab);
  return true;
}

void Controller::restore(std::function<void(bool)> done) {
  if (!session_) return done(false);
  session_->restore([done = std::move(done)] { done(true); });
}

bool Controller::close() {
  if (!page_ || !window_) return false;
  if (closing_) return true;
  popupClosing();
  page_->close();
  return true;
}

void Controller::popupClosing() {
  if (closing_ || !window_) return;
  closing_ = true;
  // Le PiP avait le focus (un clic dessus) : il revient à la fenêtre principale — sans cela
  // personne ne l'a, et la page du lecteur ne répond qu'après un clic.
  const bool hadFocus = window_->focused();
  endSession();
  releaseVideo();
  window_->hide();
  if (hadFocus) platform_.focusHost();
}

void Controller::popupClosed() {
  popupClosing();
  window_.reset();
  page_.reset();
  closing_ = false;
}

void Controller::hostClosing() {
  pending_.reset();
  arming_.reset();
  if (close()) std::fprintf(stderr, "[pip] la fenêtre principale se ferme : le PiP part d'abord\n");
}

void Controller::setCursor(int cefCursorType) {
  if (window_) platform_.setCursor(*window_, cefCursorType);
}

void Controller::endSession() { session_.reset(); }

void Controller::releaseVideo() {
  if (!lent_) return;
  lent_ = false;
  if (video_) video_->reclaimVideo();
}

Size Controller::viewSize() const {
  if (window_) {
    const Box b = window_->bounds();
    return {b.width, b.height};
  }
  if (pending_) return pending_->window;
  return {1, 1};
}

double Controller::scale() const { return window_ ? window_->backingScale() : 1.0; }

Box Controller::screenBounds() const { return window_ ? window_->screenBounds() : Box{}; }

Box Controller::screenWorkArea() const { return window_ ? window_->screenWorkArea() : Box{}; }

Point Controller::viewToScreen(Point view) const {
  if (!window_) return view;
  const Box b = window_->bounds();
  return {b.x + view.x, b.y + view.y};
}

std::optional<Box> Controller::windowBounds() const {
  if (!window_) return std::nullopt;
  return window_->bounds();
}

Compositor* Controller::compositor() const { return window_ ? window_->compositor() : nullptr; }

}  // namespace tentacle::pip
