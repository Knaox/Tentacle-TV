#include "shell/cursors.h"

#include <cmath>
#include <optional>

namespace tentacle {
namespace {

// Les formes que SDL sait montrer telles quelles.
std::optional<SDL_SystemCursor> sdlShape(cef_cursor_type_t t) {
  switch (t) {
    case CT_POINTER: return SDL_SYSTEM_CURSOR_DEFAULT;
    case CT_CROSS: return SDL_SYSTEM_CURSOR_CROSSHAIR;
    case CT_HAND: return SDL_SYSTEM_CURSOR_POINTER;
    case CT_IBEAM: return SDL_SYSTEM_CURSOR_TEXT;
    case CT_WAIT: return SDL_SYSTEM_CURSOR_WAIT;
    case CT_PROGRESS: return SDL_SYSTEM_CURSOR_PROGRESS;
    case CT_EASTRESIZE: return SDL_SYSTEM_CURSOR_E_RESIZE;
    case CT_WESTRESIZE: return SDL_SYSTEM_CURSOR_W_RESIZE;
    case CT_NORTHRESIZE: return SDL_SYSTEM_CURSOR_N_RESIZE;
    case CT_SOUTHRESIZE: return SDL_SYSTEM_CURSOR_S_RESIZE;
    case CT_NORTHEASTRESIZE: return SDL_SYSTEM_CURSOR_NE_RESIZE;
    case CT_NORTHWESTRESIZE: return SDL_SYSTEM_CURSOR_NW_RESIZE;
    case CT_SOUTHEASTRESIZE: return SDL_SYSTEM_CURSOR_SE_RESIZE;
    case CT_SOUTHWESTRESIZE: return SDL_SYSTEM_CURSOR_SW_RESIZE;
    case CT_EASTWESTRESIZE:
    case CT_COLUMNRESIZE: return SDL_SYSTEM_CURSOR_EW_RESIZE;
    case CT_NORTHSOUTHRESIZE:
    case CT_ROWRESIZE: return SDL_SYSTEM_CURSOR_NS_RESIZE;
    case CT_NORTHEASTSOUTHWESTRESIZE: return SDL_SYSTEM_CURSOR_NESW_RESIZE;
    case CT_NORTHWESTSOUTHEASTRESIZE: return SDL_SYSTEM_CURSOR_NWSE_RESIZE;
    case CT_MOVE: return SDL_SYSTEM_CURSOR_MOVE;
    case CT_NOTALLOWED:
    case CT_NODROP: return SDL_SYSTEM_CURSOR_NOT_ALLOWED;
    default: return std::nullopt;
  }
}

// Sans image native (Linux) : la forme SDL la plus proche de celle du thème de curseurs.
SDL_SystemCursor closestShape(cef_cursor_type_t t) {
  switch (t) {
    case CT_GRAB:
    case CT_GRABBING: return SDL_SYSTEM_CURSOR_POINTER;
    case CT_CELL: return SDL_SYSTEM_CURSOR_CROSSHAIR;
    case CT_VERTICALTEXT: return SDL_SYSTEM_CURSOR_TEXT;
    case CT_MIDDLEPANNING:
    case CT_MIDDLE_PANNING_VERTICAL:
    case CT_MIDDLE_PANNING_HORIZONTAL:
    case CT_EASTPANNING:
    case CT_NORTHPANNING:
    case CT_NORTHEASTPANNING:
    case CT_NORTHWESTPANNING:
    case CT_SOUTHPANNING:
    case CT_SOUTHEASTPANNING:
    case CT_SOUTHWESTPANNING:
    case CT_WESTPANNING:
    case CT_DND_MOVE: return SDL_SYSTEM_CURSOR_MOVE;
    case CT_DND_NONE: return SDL_SYSTEM_CURSOR_NOT_ALLOWED;
    default: return SDL_SYSTEM_CURSOR_DEFAULT;
  }
}

SDL_Cursor* colorCursor(SDL_Surface* image, int hotX, int hotY) {
  if (!image) return nullptr;
  SDL_Cursor* c = SDL_CreateColorCursor(image, hotX, hotY);
  SDL_DestroySurface(image);
  return c;
}

// `cursor: url(…)` : pixels BGRA de Skia à `image_scale_factor` ; base 1× + variante dense.
SDL_Surface* customImage(const CefCursorInfo& info, int& hotX, int& hotY) {
  if (!info.buffer || info.size.width <= 0 || info.size.height <= 0) return nullptr;
  SDL_Surface* full = SDL_CreateSurfaceFrom(info.size.width, info.size.height,
                                            SDL_PIXELFORMAT_BGRA32, info.buffer,
                                            info.size.width * 4);
  if (!full) return nullptr;
  SDL_Surface* owned = SDL_DuplicateSurface(full);  // le tampon de CEF ne vit que pendant l'appel
  SDL_DestroySurface(full);
  if (!owned) return nullptr;
  const float scale = info.image_scale_factor > 1.0f ? info.image_scale_factor : 1.0f;
  hotX = int(std::lround(info.hotspot.x / scale));
  hotY = int(std::lround(info.hotspot.y / scale));
  if (scale == 1.0f) return owned;
  SDL_Surface* base = SDL_ScaleSurface(owned, int(std::lround(owned->w / scale)),
                                       int(std::lround(owned->h / scale)), SDL_SCALEMODE_LINEAR);
  if (!base) return owned;
  SDL_AddSurfaceAlternateImage(base, owned);
  SDL_DestroySurface(owned);
  return base;
}

}  // namespace

CursorSet::~CursorSet() {
  for (auto* m : {&system_, &native_, &drag_}) {
    for (auto& [_, c] : *m) {
      if (c) SDL_DestroyCursor(c);
    }
  }
  if (custom_) SDL_DestroyCursor(custom_);
  if (oldCustom_) SDL_DestroyCursor(oldCustom_);
}

SDL_Cursor* CursorSet::system(SDL_SystemCursor shape) {
  auto& c = system_[int(shape)];
  if (!c) c = SDL_CreateSystemCursor(shape);
  return c;
}

SDL_Cursor* CursorSet::forPage(cef_cursor_type_t type, CefCursorHandle native,
                               const CefCursorInfo& custom) {
  if (type == CT_NONE) return nullptr;
  if (auto shape = sdlShape(type)) return system(*shape);
  if (type == CT_CUSTOM) {
    int hx = 0, hy = 0;
    if (SDL_Cursor* c = colorCursor(customImage(custom, hx, hy), hx, hy)) {
      // Le curseur courant ne se détruit pas sous les pieds de SDL : on garde l'avant-dernier.
      if (oldCustom_) SDL_DestroyCursor(oldCustom_);
      oldCustom_ = custom_;
      custom_ = c;
      return c;
    }
    return system(SDL_SYSTEM_CURSOR_DEFAULT);
  }
  auto it = native_.find(int(type));
  if (it != native_.end()) return it->second ? it->second : system(closestShape(type));
  int hx = 0, hy = 0;
  SDL_Cursor* c = colorCursor(platform::nativeCursorImage(native, hx, hy), hx, hy);
  native_[int(type)] = c;  // nullptr retenu aussi : la forme approchée, sans réessayer
  return c ? c : system(closestShape(type));
}

SDL_Cursor* CursorSet::forDrag(cef_drag_operations_mask_t operation) {
  auto it = drag_.find(int(operation));
  if (it == drag_.end()) {
    int hx = 0, hy = 0;
    it = drag_.emplace(int(operation),
                       colorCursor(platform::dragCursorImage(operation, hx, hy), hx, hy)).first;
  }
  if (it->second) return it->second;
  return system(operation == DRAG_OPERATION_NONE ? SDL_SYSTEM_CURSOR_NOT_ALLOWED
                                                 : SDL_SYSTEM_CURSOR_DEFAULT);
}

}  // namespace tentacle
