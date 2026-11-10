// Compositeur de Windows : DirectComposition sur la fenêtre SDL. De bas en haut : la couche
// vidéo (chaîne d'échange de mpv, ou aplat de banc), la page (texture D3D11 partagée par CEF),
// la popup. La page est transparente là où elle ne dessine rien : la vidéo se voit dessous,
// sans fenêtre fille ni fenêtre transparente (ce qu'Electron doit faire, `videoWindow.ts`).
// Pendant un redimensionnement, la boucle modale de Win32 continue de distribuer les messages
// de la pompe CEF (message_pump_windows.cpp) : les images arrivent et sont présentées.

#include <SDL3/SDL.h>

#include <cmath>
#include <cstdio>
#include <memory>
#include <sstream>

#include "compositor/compositor.h"
#include "platform/windows/fake_video_windows.h"
#include "platform/windows/web_layer_windows.h"

namespace tentacle {
namespace {

using win::DcompContext;

HWND hwndOf(SDL_Window* window) {
  return static_cast<HWND>(
      SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
}

class WindowsCompositor final : public Compositor {
 public:
  explicit WindowsCompositor(DcompContext& ctx)
      : ctx_(ctx), web_(std::make_unique<win::WindowsWebLayer>(ctx)) {}

  ~WindowsCompositor() override {
    // Les surfaces (vidéo, aplats) sont déjà parties (app.cpp) ; la page, puis le matériel
    // de la fenêtre, qu'aucune autre couche ne tient plus.
    setVideoLayer(nullptr);
    const HWND hwnd = ctx_.hwnd;
    web_.reset();
    DcompContext::release(hwnd);
  }

  void setVideoLayer(VideoSurface* surface) override {
    if (video_) ctx_.videoSlot->RemoveAllVisuals();
    video_ = surface;
    if (video_) {
      auto* visual = static_cast<IDCompositionVisual*>(video_->nativeLayer());
      if (visual) ctx_.videoSlot->AddVisual(visual, FALSE, nullptr);
      video_->setFrame({0, 0, width_, height_});
      video_->show();
    }
    ctx_.commit();
  }

  WebLayer* webLayer() override { return web_.get(); }

  void resize(double widthDip, double heightDip, double scale) override {
    width_ = widthDip;
    height_ = heightDip;
    scale_ = scale;
    if (video_) video_->setFrame({0, 0, widthDip, heightDip});
  }

  CompositorStats stats() const override { return web_->stats(); }

  std::string describeLayers() const override {
    std::ostringstream out;
    out << "DirectComposition " << int(std::lround(width_)) << "x" << int(std::lround(height_)) << " DIP ×" << scale_
        << "\n  vidéo : ";
    if (video_) {
      const PixelSize px = video_->pixelSize();
      out << (video_->visible() ? "visible " : "cachée ") << px.w << "x" << px.h << " px ("
          << video_->colorState().pixelFormat << ")";
    } else {
      out << "-";
    }
    out << "\n  page : " << web_->viewWidth() << "x" << web_->viewHeight() << " px"
        << "\n  popup : " << (web_->popupVisible() ? "visible" : "-") << "\n";
    return out.str();
  }

 private:
  DcompContext& ctx_;
  std::unique_ptr<win::WindowsWebLayer> web_;
  VideoSurface* video_ = nullptr;
  double width_ = 0, height_ = 0, scale_ = 1;
};

// Sans DirectComposition (pilote absent, session sans GPU ni WARP) : l'app tourne, rien
// ne s'affiche — et le journal le dit.
class NullCompositor final : public Compositor {
  class NullWeb final : public WebLayer {
   public:
    void presentView(const WebFrame&) override {}
    void presentPopup(const WebFrame&) override {}
    void setPopup(bool, PopupRect) override {}
    bool samplePixel(int, int, uint8_t*) override { return false; }
  };

 public:
  void setVideoLayer(VideoSurface*) override {}
  WebLayer* webLayer() override { return &web_; }
  void resize(double, double, double) override {}
  CompositorStats stats() const override { return {}; }
  std::string describeLayers() const override { return "(aucun compositeur : DirectComposition indisponible)"; }

 private:
  NullWeb web_;
};

}  // namespace

std::unique_ptr<Compositor> Compositor::create(SDL_Window* window) {
  if (DcompContext* ctx = DcompContext::acquire(hwndOf(window))) return std::make_unique<WindowsCompositor>(*ctx);
  std::fprintf(stderr, "[compositeur] DirectComposition indisponible : la fenêtre restera vide\n");
  return std::make_unique<NullCompositor>();
}

std::unique_ptr<VideoSurface> Compositor::createFakeVideoSurface(SDL_Window* window, uint32_t rgb) {
  DcompContext* ctx = DcompContext::find(hwndOf(window));
  if (!ctx) return nullptr;
  return std::make_unique<win::FakeVideoSurface>(*ctx, float((rgb >> 16) & 0xFF) / 255.0f,
                                                 float((rgb >> 8) & 0xFF) / 255.0f, float(rgb & 0xFF) / 255.0f, 0.0f);
}

std::unique_ptr<VideoSurface> Compositor::createFakeEdrSurface(SDL_Window* window, float level) {
  DcompContext* ctx = DcompContext::find(hwndOf(window));
  if (!ctx) return nullptr;
  return std::make_unique<win::FakeVideoSurface>(*ctx, 1.0f, 1.0f, 1.0f, level);
}

}  // namespace tentacle
