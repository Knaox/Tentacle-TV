#include "pip/pip_session.h"

#include <algorithm>

#include "pip/rules/pip_motion.h"
#include "pip/rules/pip_placement.h"
#include "pip/rules/pip_resize_guard.h"

namespace tentacle::pip {

Session::Session(Window& window, Desktop& desktop, Ticker& ticker, Frame frame, Mode mode,
                 double aspect)
    : window_(window), desktop_(desktop), ticker_(ticker), frame_(frame), mode_(mode),
      aspect_(aspect) {
  const Box now = window_.bounds();
  size_ = {now.width, now.height};
  WindowEvents events;
  // Fin d'un redimensionnement par les bords du système : la taille choisie.
  events.resizedByUser = [this] {
    const Box b = window_.bounds();
    size_ = {b.width, b.height};
  };
  events.willResize = [this](const Box& current, const Box& proposed) {
    return guardResize(frame_, mode_, current, proposed, aspect_, maxVideoWidth(),
                       desktop_.hostContentBounds());
  };
  events.hostMoved = [this] { hostChanged(); };
  events.hostRestored = [this] {
    window_.applyMode(mode_);
    if (mode_ == Mode::docked) place();
  };
  window_.setEvents(std::move(events));
  window_.applyMode(mode_);
  rest_ = cornerPlacement(frame_, size_, cornerArea());
  set(desktop_.reducedMotion() ? rest_ : windowAround(frame_, pictureIn(playerArea(), aspect_)));
}

Session::~Session() {
  endGesture();
  stopAnimation();
  window_.setEvents({});
}

void Session::enter() { animate(rest_, kShrinkMs); }

void Session::settle() {
  stopAnimation();
  set(rest_);
}

void Session::restore(std::function<void()> done) {
  endGesture();
  const Box now = window_.bounds();
  const double inset = 2 * frame_.inset();
  const double aspect = (now.width - inset) / std::max(1.0, now.height - inset);
  animate(windowAround(frame_, pictureIn(playerArea(), aspect)), kGrowMs, std::move(done));
}

void Session::setMode(Mode mode, std::optional<Size> video) {
  endGesture();
  mode_ = mode;
  window_.applyMode(mode_);
  if (video) {
    resize(video->width, video->height);
  } else if (mode_ == Mode::docked) {
    place();
  }
}

void Session::resize(double videoWidth, double videoHeight) {
  const Size size = windowSize(frame_, videoWidth, videoHeight);
  size_ = size;
  const Box now = window_.bounds();
  const Box target = mode_ == Mode::docked
                         ? cornerPlacement(frame_, size, cornerArea())
                         : resizeInPlace(frame_, now, size, desktop_.workAreaMatching(now));
  animate(target, kResizeMs);
}

void Session::setGesture(std::optional<Gesture> kind, std::optional<Point> grab) {
  endGesture();
  // Un geste interrompt l'entrée : la main l'emporte toujours.
  stopAnimation();
  // Ancré, le PiP est le coin de l'application : il ne se glisse pas.
  if (!kind || (*kind == Gesture::move && mode_ == Mode::docked)) return;
  // Wayland : le compositeur glisse la fenêtre lui-même ; rien à suivre ici.
  if (*kind == Gesture::move && window_.beginSystemMove()) return;
  const Box start = window_.bounds();
  const Point cursor = desktop_.cursor();
  gesture_.kind = *kind;
  gesture_.start = start;
  gesture_.grab = grab.value_or(Point{cursor.x - start.x, cursor.y - start.y});
  gesture_.origin = cursor;
  gesture_.cancel = ticker_.every(kFrameMs, [this] { follow(); });
}

void Session::follow() {
  if (!gesture_.cancel) return;
  const Point cursor = desktop_.cursor();
  if (gesture_.kind == Gesture::move) {
    set(dragTo(frame_, gesture_.start, gesture_.grab, cursor, desktop_.workAreaNearest(cursor)));
    return;
  }
  const double dx = cursor.x - gesture_.origin.x;
  const double dy = cursor.y - gesture_.origin.y;
  set(stretchFrom(frame_, gesture_.start, gesture_.kind, dx, dy, maxVideoWidth()));
}

void Session::endGesture() {
  if (!gesture_.cancel) return;
  auto cancel = std::move(gesture_.cancel);
  gesture_.cancel = nullptr;
  cancel();
  // Un coin tiré : la taille où la main l'a laissé devient la taille voulue.
  if (gesture_.kind != Gesture::move) {
    const Box b = window_.bounds();
    size_ = {b.width, b.height};
  }
}

void Session::animate(const Box& to, double durationMs, std::function<void()> done) {
  stopAnimation();
  const Box from = window_.bounds();
  if (desktop_.reducedMotion() || from == to) {
    set(to);
    if (done) done();
    return;
  }
  struct Progress {
    double elapsed = 0, last = 0;
  };
  auto progress = std::make_shared<Progress>();
  progress->last = ticker_.nowMs();
  auto step = [this, from, to, durationMs, progress] {
    const double now = ticker_.nowMs();
    progress->elapsed += std::min(now - progress->last, kMaxStepMs);
    progress->last = now;
    const double t = std::min(1.0, progress->elapsed / durationMs);
    set(interpolateBox(from, to, easeOutCubic(t)));
    if (t >= 1) stopAnimation();
  };
  animation_.done = std::move(done);
  animation_.cancel = ticker_.every(kFrameMs, step);
  step();
}

void Session::stopAnimation() {
  if (!animation_.cancel) return;
  auto cancel = std::move(animation_.cancel);
  auto done = std::move(animation_.done);
  animation_ = {};
  cancel();
  if (done) done();
}

void Session::place() { set(cornerPlacement(frame_, size_, cornerArea())); }

void Session::set(const Box& box) {
  if (window_.bounds() == box) return;
  window_.setBounds(box);
}

double Session::maxVideoWidth() {
  if (mode_ == Mode::docked) return desktop_.hostContentBounds().width * kMaxShareDocked;
  return desktop_.displayBoundsMatching(window_.bounds()).width * kMaxShareFloating;
}

Box Session::cornerArea() {
  return mode_ == Mode::docked ? desktop_.hostContentBounds()
                               : desktop_.workAreaMatching(desktop_.hostBounds());
}

Box Session::playerArea() {
  Box content = desktop_.hostContentBounds();
  const double top = desktop_.bannerInset();
  content.y += top;
  content.height -= top;
  return content;
}

void Session::hostChanged() {
  if (mode_ == Mode::docked && !gesture_.cancel && !animation_.cancel) place();
}

}  // namespace tentacle::pip
