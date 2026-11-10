// Couche vidéo factice (aplat, --fake-video) et compositeur de secours sous Linux.

#include <cstdio>

#include "compositor/compositor.h"
#include "platform/linux/video_layer_linux.h"

namespace tentacle {
namespace {

// Aplat sous la page : prouve l'empilement (page transparente au-dessus) sans mpv.
class FakeColorSurface final : public VideoSurface, public platform::LinuxVideoLayer {
 public:
  explicit FakeColorSurface(uint32_t rgb) : rgb_(rgb) {}
  void show() override { visible_ = true; redraw(); }
  void hide() override { visible_ = false; redraw(); }
  bool visible() const override { return visible_; }
  void setFrame(RectPt f) override { frame_ = f; hasFrame_ = true; redraw(); }
  double backingScale() const override { return 1.0; }
  void* nativeLayer() override { return static_cast<platform::LinuxVideoLayer*>(this); }
  PixelSize pixelSize() const override { return {int(frame_.width), int(frame_.height)}; }
  int64_t mpvWid() const override { return 0; }
  const char* mpvGpuContext() const override { return ""; }
  SurfaceColorState colorState() const override { return {}; }
  void onPixelSizeChanged(std::function<void(PixelSize)>) override {}

  bool frame(RectPt& out) const override {
    if (hasFrame_) out = frame_;
    return hasFrame_;
  }
  bool solidColor(float rgba[4]) const override {
    rgba[0] = float((rgb_ >> 16) & 0xff) / 255.0f;
    rgba[1] = float((rgb_ >> 8) & 0xff) / 255.0f;
    rgba[2] = float(rgb_ & 0xff) / 255.0f;
    rgba[3] = 1.0f;
    return true;
  }

 private:
  void redraw() {
    if (auto* h = platform::glHost()) h->requestRedraw();
  }
  uint32_t rgb_;
  bool visible_ = true, hasFrame_ = false;
  RectPt frame_;
};

class NullWebLayer final : public WebLayer {
 public:
  void presentView(const WebFrame&) override {}
  void presentPopup(const WebFrame&) override {}
  void setPopup(bool, PopupRect) override {}
  bool samplePixel(int, int, uint8_t*) override { return false; }
};

class NullCompositor final : public Compositor {
 public:
  void setVideoLayer(VideoSurface*) override {}
  WebLayer* webLayer() override { return &web_; }
  void resize(double, double, double) override {}
  CompositorStats stats() const override { return {}; }
  std::string describeLayers() const override { return "(aucun : EGL indisponible)"; }

 private:
  NullWebLayer web_;
};

}  // namespace

namespace platform {
std::unique_ptr<Compositor> createNullCompositor() { return std::make_unique<NullCompositor>(); }
}  // namespace platform

std::unique_ptr<VideoSurface> Compositor::createFakeVideoSurface(SDL_Window*, uint32_t rgb) {
  return std::make_unique<FakeColorSurface>(rgb);
}

// Pas d'aplat HDR sous Linux : la preuve HDR passe par mpv (sous-surface Wayland).
std::unique_ptr<VideoSurface> Compositor::createFakeEdrSurface(SDL_Window* w, float) {
  std::fprintf(stderr, "[compositeur] --fake-video=edr : sans objet sous Linux, aplat SDR\n");
  return createFakeVideoSurface(w, 0x1e6b5a);
}

}  // namespace tentacle
