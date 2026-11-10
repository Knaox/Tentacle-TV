#pragma once
// Contexte EGL (OpenGL ES 3, sinon 2) sur la surface de la fenêtre SDL3 — Wayland
// (wl_egl_window sur la wl_surface de SDL) ou X11 (la Window de SDL, son visuel).
// C'est NOTRE contexte : SDL n'y dessine rien (fenêtre créée sans SDL_WINDOW_OPENGL).
// Fil principal seulement.

// Sans les en-têtes X11 dans EGL (macros None, Bool, Status…) : poignées natives en entiers.
#ifndef EGL_NO_X11
#define EGL_NO_X11
#endif
#ifndef MESA_EGL_NO_X11_HEADERS
#define MESA_EGL_NO_X11_HEADERS
#endif
#include <EGL/egl.h>

#include <memory>

struct wl_egl_window;

namespace tentacle::platform {

struct LinuxWindow;

class EglWindow {
 public:
  // `alpha` : surface avec canal alpha (Wayland : la page laisse voir la sous-surface vidéo).
  static std::unique_ptr<EglWindow> create(const LinuxWindow& window, int widthPx, int heightPx,
                                           bool alpha);
  ~EglWindow();

  bool makeCurrent();
  void resize(int widthPx, int heightPx);
  bool swap();
  int width() const { return width_; }
  int height() const { return height_; }
  bool hasAlpha() const { return alpha_; }
  int glesMajor() const { return glesMajor_; }
  EGLDisplay display() const { return display_; }
  // Extensions EGL (dmabuf : EGL_EXT_image_dma_buf_import).
  bool hasExtension(const char* name) const;
  static void* procAddress(const char* name);

 private:
  EglWindow() = default;
  EGLDisplay display_ = EGL_NO_DISPLAY;
  EGLContext context_ = EGL_NO_CONTEXT;
  EGLSurface surface_ = EGL_NO_SURFACE;
  ::wl_egl_window* wlEgl_ = nullptr;
  int width_ = 0, height_ = 0, glesMajor_ = 0;
  bool alpha_ = false;
};

}  // namespace tentacle::platform
