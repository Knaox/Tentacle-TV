#include "platform/linux/overlay_linux.h"

#include <cstring>
#include <map>

#include "platform/linux/gl_quad_linux.h"
#include "platform/linux/video_layer_linux.h"

namespace tentacle::platform {
namespace {

std::map<SDL_Window*, OverlayHost*>& registry() {
  static std::map<SDL_Window*, OverlayHost*> r;
  return r;
}

}  // namespace

OverlayHost* overlayHost(SDL_Window* window) {
  auto it = registry().find(window);
  return it == registry().end() ? nullptr : it->second;
}

OverlayStack::OverlayStack(SDL_Window* window, GlHost* host) : window_(window), host_(host) {
  registry()[window_] = this;
}

OverlayStack::~OverlayStack() {
  if (overlayHost(window_) == this) registry().erase(window_);
}

bool OverlayStack::setOverlay(OverlaySlot slot, const uint8_t* bgra, int width, int height,
                              int stride, int x, int y) {
  if (!bgra || width <= 0 || height <= 0 || !host_->makeCurrent()) return false;
  Item& item = items_[int(slot)];
  const uint8_t* rows = bgra;
  if (stride != width * 4) {
    // GLES 2 n'a pas GL_UNPACK_ROW_LENGTH : les lignes sont resserrées avant l'envoi.
    tight_.resize(size_t(width) * size_t(height) * 4);
    for (int row = 0; row < height; ++row) {
      std::memcpy(tight_.data() + size_t(row) * size_t(width) * 4, bgra + size_t(row) * size_t(stride),
                  size_t(width) * 4);
    }
    rows = tight_.data();
  }
  // La texture de l'emplacement est créée UNE fois ; une autre taille la réalloue sur place.
  if (!item.tex) item.tex = createTexture(width, height);
  glBindTexture(GL_TEXTURE_2D, item.tex);
  glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
  if (item.w != width || item.h != height) {
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, rows);
  } else {
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, rows);
  }
  item.w = width;
  item.h = height;
  item.x = x;
  item.y = y;
  item.visible = true;
  host_->requestRedraw();
  return true;
}

void OverlayStack::moveOverlay(OverlaySlot slot, int x, int y) {
  Item& item = items_[int(slot)];
  if (item.x == x && item.y == y) return;
  item.x = x;
  item.y = y;
  if (item.visible) host_->requestRedraw();
}

void OverlayStack::clearOverlay(OverlaySlot slot) {
  Item& item = items_[int(slot)];
  if (!item.visible) return;
  item.visible = false;
  host_->requestRedraw();
}

void OverlayStack::draw(GlQuad& quad, int viewWidth, int viewHeight) {
  for (const Item& item : items_) {
    if (!item.visible || !item.tex) continue;
    quad.drawTexture(item.tex, {float(item.x), float(item.y), float(item.w), float(item.h)}, viewWidth,
                     viewHeight, true);
  }
}

std::string OverlayStack::describe() const {
  static const char* const names[kOverlaySlots] = {"bulle", "vignette"};
  std::string out;
  for (int i = 0; i < kOverlaySlots; ++i) {
    const Item& item = items_[i];
    out += std::string(" | ") + names[i] + " ";
    out += item.visible ? std::to_string(item.w) + "x" + std::to_string(item.h) + "@" + std::to_string(item.x) + "," +
                              std::to_string(item.y)
                        : "non";
  }
  return out;
}

void OverlayStack::release() {
  for (Item& item : items_) {
    if (item.tex) glDeleteTextures(1, &item.tex);
    item = Item{};
  }
}

}  // namespace tentacle::platform
