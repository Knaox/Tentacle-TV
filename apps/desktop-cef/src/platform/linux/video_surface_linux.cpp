// VideoSurface Linux. Deux montages (video_layer_linux.h) :
//  - Wayland + notre libmpv (contexte `wlhostvk`, correctif mpv-patches-linux) : une
//    sous-surface SOUS la page, mpv y dessine en Vulkan — HDR possible (video_subsurface_linux.cpp) ;
//  - sinon (X11, libmpv de la distribution) : l'API de rendu OpenGL de libmpv dans une texture
//    de notre contexte EGL, posée sous la page par le compositeur. SDR.
// Le lecteur (player.cpp) choisit : attachRenderApi() vrai → vo=libmpv ; sinon gpu-context/wid.

#include <GLES3/gl3.h>
#include <mpv/render_gl.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>

#include "platform/linux/linux_window.h"
#include "platform/linux/video_layer_linux.h"
#include "platform/linux/video_subsurface_linux.h"
#include "platform/video_surface.h"
#include "shell/main_thread.h"
#include "shell/window_scale.h"

namespace tentacle {
namespace {

using platform::glHost;

void* procAddress(void*, const char* name) {
  auto* h = glHost();
  return h ? h->procAddress(name) : nullptr;
}

class RenderApiSurface final : public VideoSurface, public platform::LinuxVideoLayer {
 public:
  explicit RenderApiSurface(const platform::LinuxWindow& w) : window_(w), alive_(std::make_shared<bool>(true)) {}
  ~RenderApiSurface() override {
    *alive_ = false;
    detachRenderApi();
  }

  void show() override { visible_ = true; redraw(); }
  void hide() override { visible_ = false; redraw(); }
  bool visible() const override { return visible_; }
  void setFrame(RectPt f) override {
    frame_ = f;
    hasFrame_ = true;
    redraw();
  }
  double backingScale() const override { return windowScale(window_.sdl).deviceScale; }
  void* nativeLayer() override { return static_cast<platform::LinuxVideoLayer*>(this); }
  PixelSize pixelSize() const override { return {texW_, texH_}; }
  int64_t mpvWid() const override { return 0; }
  const char* mpvGpuContext() const override { return ""; }
  SurfaceColorState colorState() const override {
    SurfaceColorState s;
    s.pixelFormat = "RGBA8 (API de rendu OpenGL, SDR)";
    s.windowFullscreen = SDL_GetWindowFlags(window_.sdl) & SDL_WINDOW_FULLSCREEN;
    return s;
  }
  void onPixelSizeChanged(std::function<void(PixelSize)>) override {}

  bool attachRenderApi(void* mpvHandle) override {
    auto* host = glHost();
    if (ctx_ || !host || !host->makeCurrent()) return false;
    mpv_opengl_init_params gl{&procAddress, nullptr};
    mpv_render_param params[] = {
        {MPV_RENDER_PARAM_API_TYPE, const_cast<char*>(MPV_RENDER_API_TYPE_OPENGL)},
        {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &gl},
        // Interop du décodage matériel (VA-API) : le même serveur d'affichage que la page.
        window_.wayland ? mpv_render_param{MPV_RENDER_PARAM_WL_DISPLAY, window_.wlDisplay}
                        : mpv_render_param{MPV_RENDER_PARAM_X11_DISPLAY, window_.x11Display},
        {MPV_RENDER_PARAM_INVALID, nullptr},
    };
    const int r = mpv_render_context_create(&ctx_, static_cast<mpv_handle*>(mpvHandle), params);
    if (r < 0) {
      std::fprintf(stderr, "[vidéo] API de rendu refusée : %s\n", mpv_error_string(r));
      ctx_ = nullptr;
      return false;
    }
    // Rappel sur un fil de mpv : on repasse par le fil principal pour composer.
    mpv_render_context_set_update_callback(ctx_, &RenderApiSurface::onUpdate, this);
    std::fprintf(stderr, "[vidéo] API de rendu OpenGL de libmpv (%s)\n", window_.wayland ? "Wayland" : "X11");
    return true;
  }
  void detachRenderApi() override {
    if (!ctx_) return;
    if (auto* h = glHost()) h->makeCurrent();
    mpv_render_context_set_update_callback(ctx_, nullptr, nullptr);
    mpv_render_context_free(ctx_);  // coupe la vidéo du cœur s'il en reste une
    ctx_ = nullptr;
    if (fbo_) glDeleteFramebuffers(1, &fbo_);
    if (tex_) glDeleteTextures(1, &tex_);
    fbo_ = tex_ = 0;
    texW_ = texH_ = 0;
    redraw();
  }

  // --- LinuxVideoLayer ---------------------------------------------------------------
  bool frame(RectPt& out) const override {
    if (hasFrame_) out = frame_;
    return hasFrame_;
  }
  GLuint renderTexture(int& w, int& h) override {
    if (!ctx_) return 0;
    const double s = backingScale();
    RectPt f = frame_;
    if (!hasFrame_) {
      int ww = 0, wh = 0;
      windowSizeDip(window_.sdl, ww, wh);
      f = {0, 0, double(ww), double(wh)};
    }
    const int pw = std::max(1, int(std::lround(f.width * s))), ph = std::max(1, int(std::lround(f.height * s)));
    const bool resized = ensureTarget(pw, ph);
    const uint64_t flags = mpv_render_context_update(ctx_);
    if (resized || (flags & MPV_RENDER_UPDATE_FRAME)) {
      mpv_opengl_fbo fbo{int(fbo_), pw, ph, GL_RGBA8};
      // 0 : la texture tient l'image dans le sens où le compositeur la lit (uv (0,0) en haut) —
      // mesuré sous X11 : avec 1, la mire s'affichait à l'envers (timecode en bas).
      int flip = 0;
      mpv_render_param p[] = {{MPV_RENDER_PARAM_OPENGL_FBO, &fbo},
                              {MPV_RENDER_PARAM_FLIP_Y, &flip},
                              {MPV_RENDER_PARAM_INVALID, nullptr}};
      mpv_render_context_render(ctx_, p);
      restoreGlState();
      if (trace_ && traced_++ < 5) {
        uint8_t px[4] = {};
        glBindFramebuffer(GL_FRAMEBUFFER, fbo_);
        glReadPixels(pw / 2, ph / 2, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, px);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        std::fprintf(stderr, "[vidéo] rendu %dx%d (flags %llu) centre RGBA %u,%u,%u,%u, erreur GL 0x%x\n", pw, ph,
                     (unsigned long long)flags, px[0], px[1], px[2], px[3], glGetError());
      }
    }
    w = texW_;
    h = texH_;
    return tex_;
  }
  void reportSwap() override {
    if (ctx_) mpv_render_context_report_swap(ctx_);
  }

 private:
  static void onUpdate(void* self) {
    // `self` vit tant que le rappel est posé (retiré avant mpv_render_context_free).
    auto* s = static_cast<RenderApiSurface*>(self);
    std::weak_ptr<bool> alive = s->alive_;
    postToMain([s, alive] {
      if (alive.expired()) return;
      s->redraw();
    });
  }
  void redraw() {
    if (auto* h = glHost()) h->requestRedraw();
  }
  bool ensureTarget(int w, int h) {
    if (tex_ && w == texW_ && h == texH_) return false;
    if (fbo_) glDeleteFramebuffers(1, &fbo_);
    if (tex_) glDeleteTextures(1, &tex_);
    glGenTextures(1, &tex_);
    glBindTexture(GL_TEXTURE_2D, tex_);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
    glGenFramebuffers(1, &fbo_);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo_);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex_, 0);
    glClearColor(0, 0, 0, 1);
    glClear(GL_COLOR_BUFFER_BIT);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    texW_ = w;
    texH_ = h;
    return true;
  }
  // mpv laisse son état GL (VAO, ciseaux, déballage) : le compositeur repart d'un état connu.
  static void restoreGlState() {
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindVertexArray(0);
    glDisable(GL_SCISSOR_TEST);
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
    glUseProgram(0);
  }

  platform::LinuxWindow window_;
  std::shared_ptr<bool> alive_;
  mpv_render_context* ctx_ = nullptr;
  GLuint fbo_ = 0, tex_ = 0;
  // TENTACLE_VIDEO_TRACE=1 : les premiers rendus de mpv et le pixel central (diagnostic).
  const bool trace_ = std::getenv("TENTACLE_VIDEO_TRACE") != nullptr;
  int traced_ = 0;
  int texW_ = 0, texH_ = 0;
  bool visible_ = true, hasFrame_ = false;
  RectPt frame_;
};

}  // namespace

namespace platform {
// Ici (tentacle_player) et non dans le compositeur : le socle dépend du lecteur, pas l'inverse.
namespace {
GlHost* g_host = nullptr;
}
GlHost* glHost() { return g_host; }
void setGlHost(GlHost* h) { g_host = h; }
}  // namespace platform

void prepareWindowForVideo(void*) {}

std::unique_ptr<VideoSurface> createVideoSurface(void* nativeWindow) {
  auto* w = static_cast<platform::LinuxWindow*>(nativeWindow);
  if (!w || !w->sdl) return nullptr;
  if (auto sub = platform::createVideoSubsurface(*w)) return sub;
  return std::make_unique<RenderApiSurface>(*w);
}

}  // namespace tentacle
