// Compositeur Linux : NOTRE contexte EGL sur la surface de la fenêtre SDL3 (Wayland ou X11).
// Empilement, de bas en haut : vidéo (sous-surface Wayland SOUS la surface, ou texture de
// l'API de rendu de mpv, ou aplat factice), page CEF (prémultipliée), popup (<select>).
// Les images de CEF sont COPIÉES dans nos textures pendant le rappel (le tampon de CEF ne
// vit que le temps de l'appel), puis une composition regroupée part au prochain tour.

#include <GLES2/gl2.h>

#include <chrono>
#include <cstdio>
#include <sstream>

#include "compositor/compositor.h"
#include "platform/linux/dmabuf_linux.h"
#include "platform/linux/egl_linux.h"
#include "platform/linux/gl_quad_linux.h"
#include "platform/linux/linux_window.h"
#include "platform/linux/video_layer_linux.h"
#include "shell/main_thread.h"
#include "shell/window_scale.h"

namespace tentacle {
namespace {

using platform::QuadRect;

struct Layer {  // une image de CEF copiée chez nous (octets BGRA)
  GLuint tex = 0;
  int w = 0, h = 0;
  bool ensure(int nw, int nh) {
    if (tex && nw == w && nh == h) return false;
    if (tex) glDeleteTextures(1, &tex);
    tex = platform::createTexture(nw, nh);
    w = nw;
    h = nh;
    return true;
  }
  void release() {
    if (tex) glDeleteTextures(1, &tex);
    tex = 0;
    w = h = 0;
  }
};

class GlCompositor final : public Compositor, public WebLayer, public platform::GlHost {
 public:
  GlCompositor(SDL_Window* window, std::unique_ptr<platform::EglWindow> egl)
      : window_(window), egl_(std::move(egl)), alive_(std::make_shared<bool>(true)) {
    egl_->makeCurrent();
    quad_.init();
    importer_ = platform::DmabufImporter::create(*egl_);
    platform::setGlHost(this);
  }
  ~GlCompositor() override {
    *alive_ = false;
    platform::setGlHost(nullptr);
    egl_->makeCurrent();
    page_.release();
    popup_.release();
    importer_.reset();
    quad_.destroy();
  }

  // --- Compositor ---------------------------------------------------------------------
  void setVideoLayer(VideoSurface* s) override {
    video_ = s ? static_cast<platform::LinuxVideoLayer*>(s->nativeLayer()) : nullptr;
    videoSurface_ = s;
    requestRedraw();
  }
  WebLayer* webLayer() override { return this; }
  void resize(double, double, double) override {
    int w = 0, h = 0;
    SDL_GetWindowSizeInPixels(window_, &w, &h);
    egl_->resize(w, h);
    requestRedraw();
  }
  CompositorStats stats() const override { return stats_; }
  std::string describeLayers() const override {
    std::ostringstream o;
    o << "egl " << egl_->width() << "x" << egl_->height() << (egl_->hasAlpha() ? " alpha" : "")
      << " | vidéo " << (!video_ ? "aucune" : video_->isSubsurface() ? "sous-surface" : "texture")
      << " | page " << page_.w << "x" << page_.h << " | popup "
      << (popupVisible_ ? std::to_string(popup_.w) + "x" + std::to_string(popup_.h) : "non")
      << " | dmabuf " << (importer_ ? "oui" : "non") << " (" << stats_dmabuf_ << " images)";
    return o.str();
  }

  // --- WebLayer -----------------------------------------------------------------------
  void presentView(const WebFrame& f) override {
    const auto t0 = std::chrono::steady_clock::now();
    if (!copyFrame(f, page_)) return;
    stats_.viewFrames++;
    if (f.dirtyPixels >= 0) stats_.dirtyPixels += uint64_t(f.dirtyPixels);
    stats_.viewPixels += uint64_t(f.width) * uint64_t(f.height);
    const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    stats_.lastCopyMs = ms;
    if (ms > stats_.maxCopyMs) stats_.maxCopyMs = ms;
    requestRedraw();
  }
  void presentPopup(const WebFrame& f) override {
    if (!copyFrame(f, popup_)) return;
    stats_.popupFrames++;
    requestRedraw();
  }
  void setPopup(bool visible, PopupRect rect) override {
    popupVisible_ = visible;
    popupRect_ = rect;
    requestRedraw();
  }
  bool samplePixel(int x, int y, uint8_t bgra[4]) override {
    if (!page_.tex || x < 0 || y < 0 || x >= page_.w || y >= page_.h || !egl_->makeCurrent()) return false;
    GLuint fbo = platform::createFramebuffer(page_.tex);
    if (!fbo) return false;
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glReadPixels(x, y, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, bgra);  // la texture tient du BGRA
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glDeleteFramebuffers(1, &fbo);
    return true;
  }

  // --- GlHost -------------------------------------------------------------------------
  bool makeCurrent() override { return egl_->makeCurrent(); }
  void* procAddress(const char* name) override { return platform::EglWindow::procAddress(name); }
  void requestRedraw() override {
    if (redrawPending_) return;
    redrawPending_ = true;
    std::weak_ptr<bool> alive = alive_;
    postToMain([this, alive] {
      if (alive.expired()) return;
      redrawPending_ = false;
      compose();
    });
  }

 private:
  // Copie l'image de CEF dans `layer` : octets (OnPaint) ou dmabuf (OnAcceleratedPaint).
  bool copyFrame(const WebFrame& f, Layer& layer) {
    if (f.width <= 0 || f.height <= 0 || !egl_->makeCurrent()) return false;
    if (layer.ensure(f.width, f.height) && &layer == &page_) stats_.viewSizeChanges++;
    if (f.pixels) {
      glBindTexture(GL_TEXTURE_2D, layer.tex);
      glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
      glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, f.width, f.height, GL_RGBA, GL_UNSIGNED_BYTE, f.pixels);
      return true;
    }
    if (f.sharedHandle && importer_ && importer_->copyInto(f.sharedHandle, layer.tex, f.width, f.height, quad_)) {
      stats_dmabuf_++;
      return true;
    }
    return false;
  }

  void compose() {
    if (!egl_->makeCurrent()) return;
    int w = 0, h = 0;
    SDL_GetWindowSizeInPixels(window_, &w, &h);
    egl_->resize(w, h);
    glViewport(0, 0, egl_->width(), egl_->height());
    const bool under = video_ && video_->isSubsurface() && videoSurface_ && videoSurface_->visible();
    // Sous-surface : la page doit être transparente au-dessus d'elle ; sinon, fond opaque —
    // jamais le bureau à travers la fenêtre.
    glClearColor(0, 0, 0, under ? 0.0f : 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);  // tout est prémultiplié
    drawVideo();
    if (page_.tex) quad_.drawTexture(page_.tex, {0, 0, float(page_.w), float(page_.h)}, egl_->width(), egl_->height(), true);
    if (popupVisible_ && popup_.tex) {
      quad_.drawTexture(popup_.tex, {float(popupRect_.x), float(popupRect_.y), float(popup_.w), float(popup_.h)},
                        egl_->width(), egl_->height(), true);
    }
    if (egl_->swap()) {
      countPresented();
      if (video_) video_->reportSwap();
    }
  }

  void drawVideo() {
    if (!video_ || !videoSurface_ || !videoSurface_->visible() || video_->isSubsurface()) return;
    const float s = scale();
    // Le cadre est en points (VideoSurface::setFrame), la cible en pixels.
    const RectPt f = videoFrame();
    const QuadRect r{float(f.x * s), float(f.y * s), float(f.width * s), float(f.height * s)};
    float rgba[4];
    if (video_->solidColor(rgba)) {
      quad_.drawColor(r, egl_->width(), egl_->height(), rgba);
      return;
    }
    int tw = 0, th = 0;
    if (GLuint t = video_->renderTexture(tw, th)) {
      egl_->makeCurrent();  // mpv a pu changer d'état GL : on reprend la main
      glViewport(0, 0, egl_->width(), egl_->height());
      glEnable(GL_BLEND);
      glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
      quad_.drawTexture(t, r, egl_->width(), egl_->height(), false);
    }
  }

  // Le cadre de la vidéo (DIP) : toute la fenêtre tant que la surface ne dit rien d'autre.
  RectPt videoFrame() const {
    int w = 0, h = 0;
    windowSizeDip(window_, w, h);
    RectPt r{0, 0, double(w), double(h)};
    if (video_) video_->frame(r);
    return r;
  }

  // Pixels par DIP (shell/window_scale.h) : la densité sous Wayland, l'échelle du contenu
  // (Xft.dpi…) sous X11, où SDL compte la fenêtre en pixels.
  float scale() const { return windowScale(window_).deviceScale; }

  void countPresented() {
    const auto now = std::chrono::steady_clock::now();
    stats_.presentedFrames++;
    if (lastPresent_.time_since_epoch().count()) {
      const double ms = std::chrono::duration<double, std::milli>(now - lastPresent_).count();
      if (ms > stats_.presentIntervalMaxMs) stats_.presentIntervalMaxMs = ms;
      stats_.presentIntervalMeanMs = stats_.presentIntervalMeanMs * 0.95 + ms * 0.05;
    }
    lastPresent_ = now;
    if (now - windowStart_ >= std::chrono::seconds(1)) {
      stats_.presentedFps = double(stats_.presentedFrames - windowFrames_) /
                            std::chrono::duration<double>(now - windowStart_).count();
      windowStart_ = now;
      windowFrames_ = stats_.presentedFrames;
    }
  }

  SDL_Window* window_;
  std::unique_ptr<platform::EglWindow> egl_;
  std::unique_ptr<platform::DmabufImporter> importer_;
  std::shared_ptr<bool> alive_;
  platform::GlQuad quad_;
  Layer page_, popup_;
  PopupRect popupRect_;
  bool popupVisible_ = false, redrawPending_ = false;
  platform::LinuxVideoLayer* video_ = nullptr;
  VideoSurface* videoSurface_ = nullptr;
  CompositorStats stats_;
  uint64_t stats_dmabuf_ = 0, windowFrames_ = 0;
  std::chrono::steady_clock::time_point lastPresent_{}, windowStart_ = std::chrono::steady_clock::now();
};

}  // namespace

std::unique_ptr<Compositor> Compositor::create(SDL_Window* window) {
  auto* w = platform::linuxWindow(window);
  int pw = 0, ph = 0;
  SDL_GetWindowSizeInPixels(window, &pw, &ph);
  // Alpha sous Wayland seulement : la sous-surface vidéo se voit à travers la page.
  auto egl = platform::EglWindow::create(*w, pw, ph, w->wayland);
  if (!egl) {
    std::fprintf(stderr, "[compositeur] EGL indisponible : la page ne sera pas affichée\n");
    return platform::createNullCompositor();
  }
  return std::make_unique<GlCompositor>(window, std::move(egl));
}

}  // namespace tentacle
