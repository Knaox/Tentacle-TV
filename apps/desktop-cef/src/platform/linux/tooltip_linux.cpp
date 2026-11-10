// Bulle d'aide Linux. Sous X11 et Wayland, Chromium DESSINE sa bulle (`TooltipAura`, un widget
// de views) : il n'y a pas de bulle « du système » à appeler. On fait de même : une fenêtre
// bulle de SDL (xdg_popup sous Wayland, override-redirect sous X11, sans focus), le texte mis en
// page par Pango et dessiné par Cairo — chargés à la demande (dlopen), présents partout où GTK
// l'est. Sans eux : pas de bulle (la page marche sans). Délai et couleurs : ceux de Chromium
// (500 ms ; fond gris foncé translucide, texte blanc, coins de 4).

#include <SDL3/SDL.h>
#include <dlfcn.h>

#include <algorithm>
#include <cmath>
#include <string>

#include "shell/tooltip.h"

namespace tentacle::platform {
namespace {

constexpr int kPadX = 8, kPadY = 4, kMaxWidth = 400, kBelowCursor = 20, kRadius = 4;
constexpr int kCairoArgb32 = 0;  // CAIRO_FORMAT_ARGB32
constexpr int kPangoScale = 1024;
constexpr int kPangoWrapWordChar = 2;

struct Libs {
  bool ok = false;
  void* (*image_surface_create)(int, int, int) = nullptr;
  void* (*create)(void*) = nullptr;
  void (*destroy)(void*) = nullptr;
  void (*surface_destroy)(void*) = nullptr;
  void (*surface_flush)(void*) = nullptr;
  unsigned char* (*surface_data)(void*) = nullptr;
  int (*surface_stride)(void*) = nullptr;
  void (*scale)(void*, double, double) = nullptr;
  void (*set_source_rgba)(void*, double, double, double, double) = nullptr;
  void (*new_sub_path)(void*) = nullptr;
  void (*arc)(void*, double, double, double, double, double) = nullptr;
  void (*close_path)(void*) = nullptr;
  void (*fill)(void*) = nullptr;
  void (*move_to)(void*, double, double) = nullptr;
  void* (*create_layout)(void*) = nullptr;
  void (*show_layout)(void*, void*) = nullptr;
  void (*layout_set_text)(void*, const char*, int) = nullptr;
  void (*layout_set_width)(void*, int) = nullptr;
  void (*layout_set_wrap)(void*, int) = nullptr;
  void (*layout_set_font)(void*, void*) = nullptr;
  void (*layout_pixel_size)(void*, int*, int*) = nullptr;
  void* (*font_from_string)(const char*) = nullptr;
  void (*font_free)(void*) = nullptr;
  void (*object_unref)(void*) = nullptr;
};

template <typename T>
void bind(void* lib, T& fn, const char* name) {
  if (lib) fn = reinterpret_cast<T>(dlsym(lib, name));
}

const Libs& libs() {
  static Libs l = [] {
    Libs l;
    void* cairo = dlopen("libcairo.so.2", RTLD_LAZY);
    void* pango = dlopen("libpango-1.0.so.0", RTLD_LAZY);
    void* pangocairo = dlopen("libpangocairo-1.0.so.0", RTLD_LAZY);
    void* gobject = dlopen("libgobject-2.0.so.0", RTLD_LAZY);
    bind(cairo, l.image_surface_create, "cairo_image_surface_create");
    bind(cairo, l.create, "cairo_create");
    bind(cairo, l.destroy, "cairo_destroy");
    bind(cairo, l.surface_destroy, "cairo_surface_destroy");
    bind(cairo, l.surface_flush, "cairo_surface_flush");
    bind(cairo, l.surface_data, "cairo_image_surface_get_data");
    bind(cairo, l.surface_stride, "cairo_image_surface_get_stride");
    bind(cairo, l.scale, "cairo_scale");
    bind(cairo, l.set_source_rgba, "cairo_set_source_rgba");
    bind(cairo, l.new_sub_path, "cairo_new_sub_path");
    bind(cairo, l.arc, "cairo_arc");
    bind(cairo, l.close_path, "cairo_close_path");
    bind(cairo, l.fill, "cairo_fill");
    bind(cairo, l.move_to, "cairo_move_to");
    bind(pangocairo, l.create_layout, "pango_cairo_create_layout");
    bind(pangocairo, l.show_layout, "pango_cairo_show_layout");
    bind(pango, l.layout_set_text, "pango_layout_set_text");
    bind(pango, l.layout_set_width, "pango_layout_set_width");
    bind(pango, l.layout_set_wrap, "pango_layout_set_wrap");
    bind(pango, l.layout_set_font, "pango_layout_set_font_description");
    bind(pango, l.layout_pixel_size, "pango_layout_get_pixel_size");
    bind(pango, l.font_from_string, "pango_font_description_from_string");
    bind(pango, l.font_free, "pango_font_description_free");
    bind(gobject, l.object_unref, "g_object_unref");
    l.ok = l.image_surface_create && l.create && l.destroy && l.surface_destroy &&
           l.surface_flush && l.surface_data && l.surface_stride && l.scale &&
           l.set_source_rgba && l.new_sub_path && l.arc && l.close_path && l.fill &&
           l.move_to && l.create_layout && l.show_layout && l.layout_set_text &&
           l.layout_set_width && l.layout_set_wrap && l.layout_set_font && l.layout_pixel_size &&
           l.font_from_string && l.font_free && l.object_unref;
    return l;
  }();
  return l;
}

class LinuxTooltip final : public TooltipWindow {
 public:
  explicit LinuxTooltip(SDL_Window* parent) : parent_(parent) {}
  ~LinuxTooltip() override { hide(); }

  void show(const std::string& text, float x, float y) override {
    hide();
    if (!(SDL_GetWindowFlags(parent_) & SDL_WINDOW_INPUT_FOCUS)) return;  // fenêtre au premier plan
    const Libs& L = libs();
    const float density = std::max(1.0f, SDL_GetWindowPixelDensity(parent_));
    // Mise en page sur une surface d'essai, puis dessin à la bonne taille.
    void* probe = L.image_surface_create(kCairoArgb32, 1, 1);
    void* pcr = L.create(probe);
    void* layout = L.create_layout(pcr);
    void* font = L.font_from_string("Sans 10");
    L.layout_set_font(layout, font);
    L.layout_set_wrap(layout, kPangoWrapWordChar);
    L.layout_set_width(layout, kMaxWidth * kPangoScale);
    L.layout_set_text(layout, text.c_str(), -1);
    int tw = 0, th = 0;
    L.layout_pixel_size(layout, &tw, &th);
    const int w = tw + 2 * kPadX, h = th + 2 * kPadY;  // unités de la fenêtre
    const int pw = int(std::ceil(w * density)), ph = int(std::ceil(h * density));
    void* surface = L.image_surface_create(kCairoArgb32, pw, ph);
    void* cr = L.create(surface);
    L.scale(cr, density, density);
    // Fond arrondi, puis le texte.
    L.set_source_rgba(cr, 60 / 255.0, 64 / 255.0, 67 / 255.0, 0.91);
    L.new_sub_path(cr);
    L.arc(cr, w - kRadius, kRadius, kRadius, -M_PI / 2, 0);
    L.arc(cr, w - kRadius, h - kRadius, kRadius, 0, M_PI / 2);
    L.arc(cr, kRadius, h - kRadius, kRadius, M_PI / 2, M_PI);
    L.arc(cr, kRadius, kRadius, kRadius, M_PI, 3 * M_PI / 2);
    L.close_path(cr);
    L.fill(cr);
    L.set_source_rgba(cr, 1, 1, 1, 0.87);
    L.move_to(cr, kPadX, kPadY);
    L.show_layout(cr, layout);
    L.surface_flush(surface);

    window_ = SDL_CreatePopupWindow(parent_, int(x), int(y) + kBelowCursor, w, h,
                                    SDL_WINDOW_TOOLTIP | SDL_WINDOW_TRANSPARENT |
                                        SDL_WINDOW_HIGH_PIXEL_DENSITY);
    if (window_) renderer_ = SDL_CreateRenderer(window_, nullptr);
    if (renderer_) {
      // ARGB32 de Cairo = ARGB8888 dans l'ordre natif, prémultiplié.
      SDL_Texture* tex = SDL_CreateTexture(renderer_, SDL_PIXELFORMAT_ARGB8888,
                                           SDL_TEXTUREACCESS_STATIC, pw, ph);
      if (tex) {
        SDL_UpdateTexture(tex, nullptr, L.surface_data(surface), L.surface_stride(surface));
        SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_BLEND_PREMULTIPLIED);
        SDL_SetRenderDrawColor(renderer_, 0, 0, 0, 0);
        SDL_RenderClear(renderer_);
        SDL_RenderTexture(renderer_, tex, nullptr, nullptr);
        SDL_RenderPresent(renderer_);
        SDL_DestroyTexture(tex);
      }
    }
    L.destroy(cr);
    L.surface_destroy(surface);
    L.font_free(font);
    L.object_unref(layout);
    L.destroy(pcr);
    L.surface_destroy(probe);
  }

  void hide() override {
    if (renderer_) SDL_DestroyRenderer(renderer_);
    if (window_) SDL_DestroyWindow(window_);
    renderer_ = nullptr;
    window_ = nullptr;
  }

  bool visible() const override { return window_ != nullptr; }

 private:
  SDL_Window* parent_;
  SDL_Window* window_ = nullptr;
  SDL_Renderer* renderer_ = nullptr;
};

}  // namespace

std::unique_ptr<TooltipWindow> createTooltipWindow(SDL_Window* parent) {
  if (!libs().ok) return nullptr;
  return std::make_unique<LinuxTooltip>(parent);
}

int tooltipDelayMs() { return 500; }

}  // namespace tentacle::platform
