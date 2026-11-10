// Compositeur de Windows : DirectComposition sur la fenêtre SDL. De bas en haut : la couche
// vidéo (chaîne d'échange de mpv, ou aplat de banc), la page (texture D3D11 partagée par CEF),
// la popup. La page est transparente là où elle ne dessine rien : la vidéo se voit dessous,
// sans fenêtre fille ni fenêtre transparente (ce qu'Electron doit faire, `videoWindow.ts`).
// Pendant un redimensionnement, la boucle modale de Win32 continue de distribuer les messages
// de la pompe CEF (message_pump_windows.cpp) : les images arrivent et sont présentées.

#include <SDL3/SDL.h>

#include <algorithm>
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
    // Les surfaces (vidéo, aplats) sont déjà parties (app.cpp), la vidéo prêtée est rendue
    // (le PiP part avant) ; la page, puis l'arbre de la fenêtre.
    reclaimVideo();
    setVideoLayer(nullptr);
    const HWND hwnd = ctx_.hwnd;
    web_.reset();
    DcompContext::release(hwnd);
  }

  void setVideoLayer(VideoSurface* surface) override {
    if (borrower_) {
      // Prêtée (PiP) : une vraie couche va chez l'emprunteur ; la couche du repos reste ici.
      const bool lend = surface && surface != home_;
      if (!lend) borrower_->setVideoLayer(nullptr);
      if (shown_) detach(shown_);
      video_ = surface;
      if (lend) borrower_->setVideoLayer(surface);
      else if (surface) attach(surface);
    } else {
      if (shown_) detach(shown_);
      video_ = surface;
      if (video_) attach(video_);
    }
    ctx_.commit();
  }

  // --- PiP : le visuel de la chaîne de mpv change d'arbre (même périphérique DComp pour
  // toutes les fenêtres : dcomp_context_windows.h) ; mpv n'en sait rien, ni sortie ni HDR ne
  // changent. Seule sa taille suit la fenêtre qui la porte (d3d11-composition-size).
  bool canLendVideo() const override { return true; }

  bool lendVideo(Compositor* borrower, VideoSurface* home) override {
    if (!borrower || borrower == this) return false;
    borrower_ = borrower;
    home_ = home;
    VideoSurface* current = video_;
    if (current && current != home_) {
      detach(current);
      ctx_.commit();  // hors de cet arbre AVANT d'entrer dans l'autre (un visuel, un parent)
      borrower_->setVideoLayer(current);
    }
    return true;
  }

  void reclaimVideo() override {
    if (!borrower_) return;
    borrower_->setVideoLayer(nullptr);
    borrower_ = nullptr;
    home_ = nullptr;
    if (shown_) detach(shown_);
    if (video_) attach(video_);
    ctx_.commit();
  }

  void setVideoInset(double inset) override {
    inset_ = inset;
    if (shown_) shown_->setFrame(videoFrame());
  }

  WebLayer* webLayer() override { return web_.get(); }

  void resize(double widthDip, double heightDip, double scale) override {
    width_ = widthDip;
    height_ = heightDip;
    scale_ = scale;
    if (shown_) shown_->setFrame(videoFrame());
  }

  CompositorStats stats() const override { return web_->stats(); }

  std::string describeLayers() const override {
    std::ostringstream out;
    out << "DirectComposition " << int(std::lround(width_)) << "x" << int(std::lround(height_)) << " DIP ×" << scale_
        << "\n  vidéo : ";
    if (shown_) {
      const PixelSize px = shown_->pixelSize();
      out << (shown_->visible() ? "visible " : "cachée ") << px.w << "x" << px.h << " px ("
          << shown_->colorState().pixelFormat << "), retrait " << inset_;
    } else {
      out << (borrower_ && video_ ? "prêtée au PiP" : "-");
    }
    out << "\n  page : " << web_->viewWidth() << "x" << web_->viewHeight() << " px"
        << "\n  popup : " << (web_->popupVisible() ? "visible" : "-") << "\n";
    return out.str();
  }

 private:
  // Le cadre de la vidéo : plein cadre, ou à `inset_` des bords (pile du PiP).
  RectPt videoFrame() const {
    return {inset_, inset_, std::max(1.0, width_ - 2 * inset_), std::max(1.0, height_ - 2 * inset_)};
  }
  void attach(VideoSurface* surface) {
    surface->setHostWindow(ctx_.hwnd);  // échelle (DPI) et écran de CETTE fenêtre
    if (auto* visual = static_cast<IDCompositionVisual*>(surface->nativeLayer()))
      ctx_.videoSlot->AddVisual(visual, FALSE, nullptr);
    surface->setFrame(videoFrame());
    surface->show();
    shown_ = surface;
  }
  void detach(VideoSurface* surface) {
    if (auto* visual = static_cast<IDCompositionVisual*>(surface->nativeLayer()))
      ctx_.videoSlot->RemoveVisual(visual);
    if (shown_ == surface) shown_ = nullptr;
  }

  DcompContext& ctx_;
  std::unique_ptr<win::WindowsWebLayer> web_;
  VideoSurface* video_ = nullptr;   // la couche posée ici (peut être prêtée)
  VideoSurface* shown_ = nullptr;   // celle que CET arbre montre
  Compositor* borrower_ = nullptr;  // PiP : la pile qui montre notre vidéo
  VideoSurface* home_ = nullptr;    // la couche du repos, qui ne part jamais
  double width_ = 0, height_ = 0, scale_ = 1, inset_ = 0;
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
