#pragma once
// Faux du PiP portable : fenêtre, bureau, horloge manuelle, compositeur, page.
#include <map>
#include <string>
#include <vector>

#include "compositor/compositor.h"
#include "pip/pip_controller.h"

namespace pip_tests {

using namespace tentacle::pip;

/// Horloge manuelle : `advance(ms)` fait tourner les minuteries, une image à la fois.
class FakeTicker : public Ticker {
 public:
  double now = 1000;
  std::function<void()> every(double intervalMs, std::function<void()> tick) override {
    const int id = next_++;
    timers_[id] = {intervalMs, now + intervalMs, std::move(tick)};
    return [this, id] { timers_.erase(id); };
  }
  double nowMs() override { return now; }
  void advance(double ms, double step = 16) {
    for (double end = now + ms; now < end;) {
      now = std::min(end, now + step);
      std::vector<int> due;
      for (auto& [id, t] : timers_) if (t.due <= now) due.push_back(id);
      for (int id : due) {
        auto it = timers_.find(id);
        if (it == timers_.end()) continue;
        it->second.due = now + it->second.interval;
        auto tick = it->second.tick;
        tick();
      }
    }
  }
  size_t running() const { return timers_.size(); }

 private:
  struct Timer {
    double interval, due;
    std::function<void()> tick;
  };
  std::map<int, Timer> timers_;
  int next_ = 1;
};

class FakeDesktop : public Desktop {
 public:
  Point cursorAt{600, 400};
  Box work{0, 25, 1512, 924}, display{0, 0, 1512, 982};
  Box hostContent{100, 125, 1280, 778}, hostFrame{100, 97, 1280, 806};
  double banner = 0;
  bool reduced = false;
  Point cursor() override { return cursorAt; }
  Box workAreaNearest(Point) override { return work; }
  Box workAreaMatching(const Box&) override { return work; }
  Box displayBoundsMatching(const Box&) override { return display; }
  Box hostContentBounds() override { return hostContent; }
  Box hostBounds() override { return hostFrame; }
  double bannerInset() override { return banner; }
  bool reducedMotion() override { return reduced; }
};

/// Le journal commun : l'ordre des gestes compte (la vidéo revient AVANT la fermeture).
inline std::vector<std::string> journal;

class FakeCompositor : public tentacle::Compositor {
 public:
  tentacle::Compositor* borrower = nullptr;
  double inset = -1;
  void setVideoLayer(tentacle::VideoSurface*) override {}
  tentacle::WebLayer* webLayer() override { return nullptr; }
  void resize(double, double, double) override {}
  tentacle::CompositorStats stats() const override { return {}; }
  std::string describeLayers() const override { return ""; }
  bool lendVideo(tentacle::Compositor* b, tentacle::VideoSurface*) override {
    borrower = b;
    journal.push_back("lend");
    return true;
  }
  void reclaimVideo() override {
    borrower = nullptr;
    journal.push_back("reclaim");
  }
  void setVideoInset(double i) override { inset = i; }
};

class FakeWindow : public Window {
 public:
  Box box;
  bool shown = false, hasFocus = false;
  std::vector<Mode> modes;
  std::string captionText;
  WindowEvents events;
  FakeCompositor stack;
  explicit FakeWindow(Box b) : box(b) {}
  ~FakeWindow() override { journal.push_back("window destroyed"); }
  Box bounds() override { return box; }
  void setBounds(const Box& b) override { box = b; }
  bool systemMove = false;  // Wayland : le compositeur glisse la fenêtre
  int systemMoves = 0;
  bool beginSystemMove() override {
    ++systemMoves;
    return systemMove;
  }
  void showInactive() override { shown = true; journal.push_back("show"); }
  void hide() override { shown = false; journal.push_back("hide"); }
  void applyMode(Mode m) override { modes.push_back(m); }
  void setCaption(const std::string& c) override { captionText = c; }
  void setEvents(WindowEvents e) override { events = std::move(e); }
  bool focused() override { return hasFocus; }
  tentacle::Compositor* compositor() override { return &stack; }
  double backingScale() override { return 2; }
  Box screenBounds() override { return {0, 0, 1512, 982}; }
  Box screenWorkArea() override { return {0, 25, 1512, 924}; }
};

class FakePlatform : public Platform {
 public:
  FakeDesktop desk;
  FakeTicker clock;
  FakeWindow* last = nullptr;
  int focusHostCalls = 0;
  Desktop& desktop() override { return desk; }
  Ticker& ticker() override { return clock; }
  std::unique_ptr<Window> createWindow(const Box& box, Mode, const std::string& caption,
                                       PageInput) override {
    auto w = std::make_unique<FakeWindow>(box);
    w->captionText = caption;
    last = w.get();
    return w;
  }
  void setCursor(Window&, int) override {}
  void focusHost() override {
    focusHostCalls++;
    journal.push_back("focus host");
  }
};

class FakePage : public Page {
 public:
  int* closes;
  explicit FakePage(int* c) : closes(c) {}
  void close() override {
    (*closes)++;
    journal.push_back("page close");
  }
  void geometryChanged() override {}
};

}  // namespace pip_tests
