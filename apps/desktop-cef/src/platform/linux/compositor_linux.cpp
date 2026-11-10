// Compositeur Linux : NOTRE contexte EGL sur la surface de la fenêtre SDL3 (Wayland ou X11).
// Empilement, de bas en haut : vidéo (sous-surface Wayland SOUS la surface, ou texture de
// l'API de rendu de mpv, ou aplat factice), page CEF (prémultipliée), popup (<select>).
// La vidéo — son cadre, son prêt à la pile du PiP — est tenue par VideoSlot (video_slot_linux.h).
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
#include "platform/linux/video_slot_linux.h"
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
      : window_(window), egl_(std::move(egl)), alive_(std::make_shared<bool>(true)), slot_(window, this) {
    egl_->makeCurrent();
    quad_.init();
    importer_ = platform::DmabufImporter::create(*egl_);
    // Le contexte du RENDU de mpv : celui de la fenêtre principale, la première pile créée
    // (la pile du PiP partage ses textures, elle ne le remplace pas).
    if (!platform::glHost()) platform::setGlHost(this);
  }
  ~GlCompositor() override {
    *alive_ = false;
    if (platform::glHost() == this) platform::setGlHost(nullptr);
    egl_->makeCurrent();
    page_.release();
    popup_.release();
    importer_.reset();
    quad_.destroy();
  }

  // --- Compositor ---------------------------------------------------------------------
  void setVideoLayer(VideoSurface* s) override {
    slot_.set(s);
    requestRedraw();
  }
  WebLayer* webLayer() override { return this; }
  void resize(double, double, double) override {
    int w = 0, h = 0;
    SDL_GetWindowSizeInPixels(window_, &w, &h);
    egl_->resize(w, h);
    slot_.resized();
    requestRedraw();
  }
  // PiP : sous Wayland seulement — la sous-surface change de parent, la texture de l'API de
  // rendu passe par les contextes partagés. X11 : pas de PiP, comme Electron (et une fenêtre
  // transparente y exigerait un gestionnaire composite).
  bool canLendVideo() const override { return platform::linuxWindow(window_)->wayland; }
  bool lendVideo(Compositor* borrower, VideoSurface* home) override {
    if (!borrower || borrower == this || !canLendVideo()) return false;
    slot_.lend(borrower, home);
    requestRedraw();
    return true;
  }
  void reclaimVideo() override {
    slot_.reclaim();
    requestRedraw();
  }
  void setVideoInset(double inset) override {
    slot_.setInset(inset);
    requestRedraw();
  }
  CompositorStats stats() const override { return stats_; }
  std::string describeLayers() const override {
    std::ostringstream o;
    o << "egl " << egl_->width() << "x" << egl_->height() << (egl_->hasAlpha() ? " alpha" : "")
      << " | vidéo " << videoKind()
      << (slot_.shown() ? " " + frameText(slot_.frame()) : std::string())
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
    // Avant CefInitialize (couche factice posée à la création), la tâche est perdue : sans ce
    // retour, plus aucune composition ne partirait jamais (mesuré : 0 image présentée).
    const bool posted = postToMain([this, alive] {
      if (alive.expired()) return;
      redrawPending_ = false;
      compose();
    });
    if (!posted) redrawPending_ = false;
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
    platform::LinuxVideoLayer* video = slot_.layer();
    const bool under = video && video->isSubsurface() && slot_.shown()->visible();
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
      if (video) video->reportSwap();
    }
  }

  void drawVideo() {
    platform::LinuxVideoLayer* video = slot_.layer();
    if (!video || !slot_.shown()->visible() || video->isSubsurface()) return;
    const float s = scale();
    // Le cadre est en points (VideoSlot), la cible en pixels.
    const RectPt f = slot_.frame();
    const QuadRect r{float(f.x * s), float(f.y * s), float(f.width * s), float(f.height * s)};
    float rgba[4];
    if (video->solidColor(rgba)) {
      quad_.drawColor(r, egl_->width(), egl_->height(), rgba);
      return;
    }
    // La texture de mpv naît dans le contexte principal : sans partage, rien à montrer ici.
    if (!egl_->sharesObjects()) return;
    int tw = 0, th = 0;
    if (GLuint t = video->renderTexture(tw, th)) {
      egl_->makeCurrent();  // mpv a pu changer d'état GL : on reprend la main
      glViewport(0, 0, egl_->width(), egl_->height());
      glEnable(GL_BLEND);
      glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
      quad_.drawTexture(t, r, egl_->width(), egl_->height(), false);
    }
  }

  // Diagnostic : ce que la pile montre — l'aplat est la couche de repos (args.h, fakeVideo).
  const char* videoKind() const {
    platform::LinuxVideoLayer* v = slot_.layer();
    float rgba[4];
    if (!v) return slot_.lent() ? "prêtée" : "aucune";
    if (v->isSubsurface()) return "sous-surface";
    return v->solidColor(rgba) ? "aplat" : "texture";
  }
  static std::string frameText(const RectPt& f) {
    std::ostringstream o;
    o << "(" << f.x << "," << f.y << " " << f.width << "x" << f.height << " DIP)";
    return o.str();
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
  platform::VideoSlot slot_;
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
