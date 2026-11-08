// Ébauche windows du compositeur (non construite sur ce Mac).
// Cible : DirectComposition : visuel vidéo sous le visuel de la page (texture D3D11 partagée de CEF).
// En attendant : la page passe par OnPaint (pixels) et n'est affichée nulle part.

#include "compositor/compositor.h"

namespace tentacle {
namespace {

class NullWebLayer final : public WebLayer {
 public:
  void presentView(const WebFrame&) override {}
  void presentPopup(const WebFrame&) override {}
  void setPopup(bool, PopupRect) override {}
  bool samplePixel(int, int, uint8_t*) override { return false; }
};

class StubCompositor final : public Compositor {
 public:
  void setVideoLayer(VideoSurface* s) override { video_ = s; }
  WebLayer* webLayer() override { return &web_; }
  void resize(double, double, double) override {}
  CompositorStats stats() const override { return {}; }
  std::string describeLayers() const override { return "(ébauche)"; }

 private:
  NullWebLayer web_;
  VideoSurface* video_ = nullptr;
};

}  // namespace

std::unique_ptr<Compositor> Compositor::create(SDL_Window*) {
  return std::make_unique<StubCompositor>();
}
std::unique_ptr<VideoSurface> Compositor::createFakeVideoSurface(SDL_Window*, uint32_t) {
  return nullptr;
}
std::unique_ptr<VideoSurface> Compositor::createFakeEdrSurface(SDL_Window*, float) {
  return nullptr;
}

}  // namespace tentacle
