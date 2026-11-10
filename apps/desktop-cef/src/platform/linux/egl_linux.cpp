#include "platform/linux/egl_linux.h"

#include <EGL/eglext.h>
#include <SDL3/SDL.h>
#include <X11/Xlib.h>
#include <wayland-egl.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <vector>

#include "platform/linux/linux_window.h"

namespace tentacle::platform {
namespace {

EGLDisplay platformDisplay(EGLenum platform, void* native) {
  auto getDisplay = reinterpret_cast<PFNEGLGETPLATFORMDISPLAYEXTPROC>(
      eglGetProcAddress("eglGetPlatformDisplayEXT"));
  if (!getDisplay) return eglGetDisplay(static_cast<EGLNativeDisplayType>(native));
  return getDisplay(platform, native, nullptr);
}

// X11 : la config dont le visuel natif est CELUI de la fenêtre de SDL (sinon BadMatch).
EGLConfig pickConfig(EGLDisplay d, bool alpha, int visualId) {
  const EGLint attrs[] = {EGL_SURFACE_TYPE, EGL_WINDOW_BIT, EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
                          EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_BLUE_SIZE, 8,
                          EGL_ALPHA_SIZE, alpha ? 8 : 0, EGL_NONE};
  EGLint n = 0;
  eglChooseConfig(d, attrs, nullptr, 0, &n);
  std::vector<EGLConfig> configs(size_t(std::max(n, 0)));
  if (n <= 0 || !eglChooseConfig(d, attrs, configs.data(), n, &n)) return nullptr;
  for (EGLConfig c : configs) {
    EGLint r, g, b, a, vid;
    eglGetConfigAttrib(d, c, EGL_RED_SIZE, &r);
    eglGetConfigAttrib(d, c, EGL_GREEN_SIZE, &g);
    eglGetConfigAttrib(d, c, EGL_BLUE_SIZE, &b);
    eglGetConfigAttrib(d, c, EGL_ALPHA_SIZE, &a);
    eglGetConfigAttrib(d, c, EGL_NATIVE_VISUAL_ID, &vid);
    if (r != 8 || g != 8 || b != 8 || (alpha ? a != 8 : a != 0 && visualId < 0)) continue;
    if (visualId >= 0 && vid != visualId) continue;
    return c;
  }
  return visualId >= 0 ? nullptr : configs.front();
}

// Le premier contexte créé (fenêtre principale) : ceux qui suivent sur le même affichage (fenêtre
// PiP) partagent ses objets — la texture de l'API de rendu de mpv se dessine dans l'une ou
// l'autre pile (Compositor::lendVideo).
EGLDisplay g_rootDisplay = EGL_NO_DISPLAY;
EGLContext g_rootContext = EGL_NO_CONTEXT;

// SDL dessine aussi en EGL (SDL_Renderer : bulle d'aide, vignette du glisser-déposer) sur LA
// MÊME connexion d'affichage, donc le MÊME EGLDisplay que le nôtre. À la destruction de sa
// dernière fenêtre GL, SDL décharge sa bibliothèque et appelle eglTerminate : notre compositeur
// perdait tout (eglMakeCurrent → EGL_NOT_INITIALIZED, l'app figée au premier survol d'un
// `title=` ; pris sous gdb le 10/11). SDL compte ses chargements : un de plus, jamais rendu,
// et il ne termine plus l'affichage tant que l'app vit.
void holdSdlGlLibrary() {
  static const bool held = [] {
    const bool ok = SDL_GL_LoadLibrary(nullptr);
    if (!ok) std::fprintf(stderr, "[egl] SDL_GL_LoadLibrary refusé : %s\n", SDL_GetError());
    return ok;
  }();
  (void)held;
}

}  // namespace

std::unique_ptr<EglWindow> EglWindow::create(const LinuxWindow& w, int widthPx, int heightPx,
                                             bool alpha) {
  std::unique_ptr<EglWindow> e(new EglWindow());
  e->width_ = std::max(widthPx, 1);
  e->height_ = std::max(heightPx, 1);
  int visualId = -1;
  if (w.wayland) {
    if (!w.wlDisplay || !w.wlSurface) return nullptr;
    e->display_ = platformDisplay(EGL_PLATFORM_WAYLAND_KHR, w.wlDisplay);
  } else {
    if (!w.x11Display || !w.x11Window) return nullptr;
    XWindowAttributes attrs{};
    XGetWindowAttributes(static_cast<Display*>(w.x11Display), Window(w.x11Window), &attrs);
    visualId = attrs.visual ? int(XVisualIDFromVisual(attrs.visual)) : -1;
    alpha = alpha && attrs.depth == 32;  // une fenêtre X11 24 bits n'a pas d'alpha
    e->display_ = platformDisplay(EGL_PLATFORM_X11_KHR, w.x11Display);
  }
  EGLint major = 0, minor = 0;
  if (e->display_ == EGL_NO_DISPLAY || !eglInitialize(e->display_, &major, &minor)) {
    std::fprintf(stderr, "[egl] eglInitialize a échoué (0x%x)\n", eglGetError());
    return nullptr;
  }
  eglBindAPI(EGL_OPENGL_ES_API);
  EGLConfig config = pickConfig(e->display_, alpha, visualId);
  if (!config && alpha) config = pickConfig(e->display_, alpha = false, visualId);
  if (!config) {
    std::fprintf(stderr, "[egl] aucune configuration RGBA8 (visuel 0x%x)\n", visualId);
    return nullptr;
  }
  e->alpha_ = alpha;
  const EGLContext share = g_rootDisplay == e->display_ ? g_rootContext : EGL_NO_CONTEXT;
  for (EGLContext with : {share, EGL_NO_CONTEXT}) {
    for (int v : {3, 2}) {
      const EGLint ctx[] = {EGL_CONTEXT_MAJOR_VERSION, v, EGL_NONE};
      e->context_ = eglCreateContext(e->display_, config, with, ctx);
      if (e->context_ != EGL_NO_CONTEXT) {
        e->glesMajor_ = v;
        e->shared_ = with != EGL_NO_CONTEXT;
        break;
      }
    }
    if (e->context_ != EGL_NO_CONTEXT || share == EGL_NO_CONTEXT) break;
    std::fprintf(stderr, "[egl] partage avec le contexte principal refusé (0x%x)\n", eglGetError());
  }
  if (g_rootContext == EGL_NO_CONTEXT && e->context_ != EGL_NO_CONTEXT) {
    g_rootDisplay = e->display_;
    g_rootContext = e->context_;
    e->shared_ = true;  // la racine partage avec elle-même
    holdSdlGlLibrary();
  }
  if (e->context_ == EGL_NO_CONTEXT) {
    std::fprintf(stderr, "[egl] eglCreateContext a échoué (0x%x)\n", eglGetError());
    return nullptr;
  }
  if (w.wayland) {
    e->wlEgl_ = wl_egl_window_create(w.wlSurface, e->width_, e->height_);
    e->surface_ = eglCreateWindowSurface(e->display_, config,
                                         reinterpret_cast<EGLNativeWindowType>(e->wlEgl_), nullptr);
  } else {
    e->surface_ = eglCreateWindowSurface(e->display_, config,
                                         static_cast<EGLNativeWindowType>(w.x11Window), nullptr);
  }
  if (e->surface_ == EGL_NO_SURFACE || !e->makeCurrent()) {
    std::fprintf(stderr, "[egl] surface impossible (0x%x)\n", eglGetError());
    return nullptr;
  }
  // Jamais d'attente de la vsync dans eglSwapBuffers : sous Wayland elle attend le rappel
  // `frame` du compositeur, qui n'arrive plus quand la fenêtre est cachée — le fil principal
  // (et CEF avec lui) resterait bloqué. Le rythme est celui de CEF et de mpv.
  eglSwapInterval(e->display_, 0);
  std::fprintf(stderr, "[egl] EGL %d.%d, GLES %d, %s, alpha %s, %dx%d px%s\n", major, minor,
               e->glesMajor_, w.wayland ? "Wayland" : "X11", alpha ? "oui" : "non", e->width_,
               e->height_, e->context_ == g_rootContext ? "" : e->shared_ ? ", partagé" : ", NON partagé");
  return e;
}

EglWindow::~EglWindow() {
  if (display_ == EGL_NO_DISPLAY) return;
  eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
  if (surface_ != EGL_NO_SURFACE) eglDestroySurface(display_, surface_);
  if (wlEgl_) wl_egl_window_destroy(wlEgl_);
  if (context_ == g_rootContext) g_rootContext = EGL_NO_CONTEXT, g_rootDisplay = EGL_NO_DISPLAY;
  if (context_ != EGL_NO_CONTEXT) eglDestroyContext(display_, context_);
  // eglTerminate : non. Le display EGL est partagé dans le processus (Wayland : la connexion
  // de SDL), le terminer couperait les autres utilisateurs.
}

bool EglWindow::makeCurrent() {
  const bool ok = eglMakeCurrent(display_, surface_, surface_, context_) == EGL_TRUE;
  // Un refus fige la fenêtre (plus de copie ni de composition) sans rien dire d'autre : on
  // dit la bascule et son code, une fois, puis le retour.
  if (ok != current_) {
    if (ok) std::fprintf(stderr, "[egl] eglMakeCurrent rétabli (contexte %p)\n", context_);
    else std::fprintf(stderr, "[egl] eglMakeCurrent refusé (0x%x, contexte %p)\n", eglGetError(), context_);
    current_ = ok;
  }
  return ok;
}

void EglWindow::resize(int widthPx, int heightPx) {
  widthPx = std::max(widthPx, 1);
  heightPx = std::max(heightPx, 1);
  if (widthPx == width_ && heightPx == height_) return;
  width_ = widthPx;
  height_ = heightPx;
  if (wlEgl_) wl_egl_window_resize(wlEgl_, width_, height_, 0, 0);
}

bool EglWindow::swap() { return eglSwapBuffers(display_, surface_) == EGL_TRUE; }

bool EglWindow::hasExtension(const char* name) const {
  const char* exts = eglQueryString(display_, EGL_EXTENSIONS);
  if (!exts) return false;
  const size_t n = std::strlen(name);
  for (const char* p = exts; (p = std::strstr(p, name)); p += n) {
    if ((p == exts || p[-1] == ' ') && (p[n] == ' ' || p[n] == 0)) return true;
  }
  return false;
}

void* EglWindow::procAddress(const char* name) {
  return reinterpret_cast<void*>(eglGetProcAddress(name));
}

}  // namespace tentacle::platform
