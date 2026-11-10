#include "platform/linux/video_subsurface_linux.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>

#include "platform/linux/linux_window.h"
#include "platform/linux/video_layer_linux.h"
#include "shell/window_scale.h"

#ifdef TENTACLE_MPV_WAYLAND_HOST
#include <wayland-client.h>

#include "viewporter-client-protocol.h"
#endif

namespace tentacle::platform {

#ifndef TENTACLE_MPV_WAYLAND_HOST
std::unique_ptr<VideoSurface> createVideoSubsurface(const LinuxWindow&) { return nullptr; }
#else
namespace {

// Doit rester identique à `struct mpv_wlhost_target` du correctif 0004 (version 1).
struct WlhostTarget {
  uint32_t magic = 0x574c4854u;
  uint32_t version = 1;
  wl_display* display = nullptr;
  wl_surface* surface = nullptr;
};

struct Globals {
  wl_compositor* compositor = nullptr;
  wl_subcompositor* subcompositor = nullptr;
  wp_viewporter* viewporter = nullptr;
};

void onGlobal(void* data, wl_registry* r, uint32_t name, const char* iface, uint32_t version) {
  auto* g = static_cast<Globals*>(data);
  if (!std::strcmp(iface, wl_compositor_interface.name)) {
    g->compositor = static_cast<wl_compositor*>(wl_registry_bind(r, name, &wl_compositor_interface, std::min(version, 4u)));
  } else if (!std::strcmp(iface, wl_subcompositor_interface.name)) {
    g->subcompositor = static_cast<wl_subcompositor*>(wl_registry_bind(r, name, &wl_subcompositor_interface, 1));
  } else if (!std::strcmp(iface, wp_viewporter_interface.name)) {
    g->viewporter = static_cast<wp_viewporter*>(wl_registry_bind(r, name, &wp_viewporter_interface, 1));
  }
}
void onGlobalRemove(void*, wl_registry*, uint32_t) {}
const wl_registry_listener kRegistry = {onGlobal, onGlobalRemove};

class VideoSubsurface final : public VideoSurface, public LinuxVideoLayer {
 public:
  static std::unique_ptr<VideoSubsurface> create(const LinuxWindow& w) {
    std::unique_ptr<VideoSubsurface> s(new VideoSubsurface(w));
    // Notre propre file d'évènements sur la connexion de SDL : SDL ne voit pas nos objets.
    s->queue_ = wl_display_create_queue(w.wlDisplay);
    auto* wrapper = static_cast<wl_display*>(wl_proxy_create_wrapper(w.wlDisplay));
    wl_proxy_set_queue(reinterpret_cast<wl_proxy*>(wrapper), s->queue_);
    s->registry_ = wl_display_get_registry(wrapper);
    wl_proxy_wrapper_destroy(wrapper);
    wl_registry_add_listener(s->registry_, &kRegistry, &s->globals_);
    wl_display_roundtrip_queue(w.wlDisplay, s->queue_);
    if (!s->globals_.compositor || !s->globals_.subcompositor) {
      std::fprintf(stderr, "[vidéo] compositeur sans wl_subcompositor : API de rendu\n");
      return nullptr;
    }
    s->child_ = wl_compositor_create_surface(s->globals_.compositor);
    s->sub_ = wl_subcompositor_get_subsurface(s->globals_.subcompositor, s->child_, w.wlSurface);
    wl_subsurface_set_desync(s->sub_);  // mpv présente sans attendre les images de la page
    wl_subsurface_place_below(s->sub_, w.wlSurface);
    wl_region* none = wl_compositor_create_region(s->globals_.compositor);
    wl_surface_set_input_region(s->child_, none);  // clics et molette : à la page
    wl_region_destroy(none);
    if (s->globals_.viewporter) s->viewport_ = wp_viewporter_get_viewport(s->globals_.viewporter, s->child_);
    wl_surface_commit(s->child_);
    s->target_.display = w.wlDisplay;
    s->target_.surface = s->child_;
    std::fprintf(stderr, "[vidéo] sous-surface Wayland sous la page (wlhostvk, viewport %s)\n",
                 s->viewport_ ? "oui" : "non");
    s->place();  // taille initiale : la fenêtre, jusqu'au premier setFrame
    return s;
  }

  ~VideoSubsurface() override {
    if (viewport_) wp_viewport_destroy(viewport_);
    if (sub_) wl_subsurface_destroy(sub_);
    if (child_) wl_surface_destroy(child_);
    if (globals_.viewporter) wp_viewporter_destroy(globals_.viewporter);
    if (globals_.subcompositor) wl_subcompositor_destroy(globals_.subcompositor);
    if (globals_.compositor) wl_compositor_destroy(globals_.compositor);
    if (registry_) wl_registry_destroy(registry_);
    if (queue_) wl_event_queue_destroy(queue_);
    if (auto* h = glHost()) h->requestRedraw();  // la page redevient opaque
  }

  void show() override {
    visible_ = true;
    place();
  }
  void hide() override {
    visible_ = false;
    place();
  }
  bool visible() const override { return visible_; }
  void setFrame(RectPt f) override {
    frame_ = f;
    hasFrame_ = true;
    place();
  }
  // Sous Wayland, unités de fenêtre = DIP = coordonnées de surface ; pixels par DIP.
  double backingScale() const override { return windowScale(window_.sdl).deviceScale; }
  void* nativeLayer() override { return static_cast<LinuxVideoLayer*>(this); }
  PixelSize pixelSize() const override { return px_; }
  int64_t mpvWid() const override { return int64_t(reinterpret_cast<intptr_t>(&target_)); }
  const char* mpvGpuContext() const override { return "wlhostvk"; }
  const char* mpvSizeOption() const override { return "wlhostvk-surface-size"; }
  SurfaceColorState colorState() const override {
    SurfaceColorState s;
    s.pixelFormat = "swapchain Vulkan de mpv (wlhostvk) — espace choisi par libplacebo";
    s.windowFullscreen = SDL_GetWindowFlags(window_.sdl) & SDL_WINDOW_FULLSCREEN;
    s.windowFrame = frame_;
    return s;
  }
  void onPixelSizeChanged(std::function<void(PixelSize)> cb) override { sizeCb_ = std::move(cb); }

  bool isSubsurface() const override { return true; }
  bool frame(RectPt& out) const override {
    if (hasFrame_) out = frame_;
    return hasFrame_;
  }

 private:
  explicit VideoSubsurface(const LinuxWindow& w) : window_(w) {}

  // Position (en points de la surface parente), taille affichée (viewport) et taille du
  // swapchain (pixels). La position s'applique au prochain commit de la page : on en demande un.
  void place() {
    RectPt f = frame_;
    if (!hasFrame_) {
      int w = 0, h = 0;
      windowSizeDip(window_.sdl, w, h);
      f = {0, 0, double(w), double(h)};
    }
    const double s = backingScale();
    const int x = visible_ ? int(std::lround(f.x)) : -int(f.width) - 10000;
    const int y = visible_ ? int(std::lround(f.y)) : -int(f.height) - 10000;
    wl_subsurface_set_position(sub_, x, y);
    const int wpt = std::max(1, int(std::lround(f.width))), hpt = std::max(1, int(std::lround(f.height)));
    if (viewport_) {
      wp_viewport_set_destination(viewport_, wpt, hpt);
    } else {
      wl_surface_set_buffer_scale(child_, std::max(1, int(std::lround(s))));
    }
    wl_surface_commit(child_);
    wl_display_dispatch_queue_pending(window_.wlDisplay, queue_);
    const PixelSize px{std::max(1, int(std::lround(f.width * s))), std::max(1, int(std::lround(f.height * s)))};
    if (px.w != px_.w || px.h != px_.h) {
      px_ = px;
      if (sizeCb_) sizeCb_(px_);
    }
    if (auto* h = glHost()) h->requestRedraw();
  }

  LinuxWindow window_;
  wl_event_queue* queue_ = nullptr;
  wl_registry* registry_ = nullptr;
  Globals globals_;
  wl_surface* child_ = nullptr;
  wl_subsurface* sub_ = nullptr;
  wp_viewport* viewport_ = nullptr;
  WlhostTarget target_;
  std::function<void(PixelSize)> sizeCb_;
  PixelSize px_;
  RectPt frame_;
  bool visible_ = true, hasFrame_ = false;
};

}  // namespace

std::unique_ptr<VideoSurface> createVideoSubsurface(const LinuxWindow& w) {
  if (!w.wayland || !w.wlDisplay || !w.wlSurface) return nullptr;
  if (const char* v = std::getenv("TENTACLE_VIDEO_RENDER_API"); v && std::strcmp(v, "1") == 0) return nullptr;
  return VideoSubsurface::create(w);
}
#endif

}  // namespace tentacle::platform
