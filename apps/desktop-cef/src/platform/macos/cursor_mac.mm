// Curseurs macOS : l'image du NSCursor que CEF fournit en rendu hors écran (celui que
// Chromium poserait dans une vraie fenêtre : openHandCursor pour `grab`, etc.), recopiée en
// surface SDL 1× + 2× ; curseurs de glisser d'AppKit (dragCopyCursor, dragLinkCursor).

#import <AppKit/AppKit.h>

#include <cmath>

#include "shell/cursors.h"

namespace tentacle::platform {
namespace {

// Rendu de l'image à `scale`, alpha rendu non prémultiplié (ce qu'attend SDL).
SDL_Surface* render(NSImage* image, NSSize size, int scale) {
  const int w = int(std::ceil(size.width * scale)), h = int(std::ceil(size.height * scale));
  if (w <= 0 || h <= 0) return nullptr;
  SDL_Surface* s = SDL_CreateSurface(w, h, SDL_PIXELFORMAT_RGBA32);
  if (!s) return nullptr;
  CGColorSpaceRef cs = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGContextRef ctx = CGBitmapContextCreate(s->pixels, size_t(w), size_t(h), 8, size_t(s->pitch), cs,
                                           kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(cs);
  if (!ctx) {
    SDL_DestroySurface(s);
    return nullptr;
  }
  NSGraphicsContext* g = [NSGraphicsContext graphicsContextWithCGContext:ctx flipped:NO];
  [NSGraphicsContext saveGraphicsState];
  NSGraphicsContext.currentContext = g;
  [image drawInRect:NSMakeRect(0, 0, w, h)];
  [NSGraphicsContext restoreGraphicsState];
  CGContextRelease(ctx);
  auto* px = static_cast<uint8_t*>(s->pixels);
  for (int y = 0; y < h; ++y) {
    for (int x = 0; x < w; ++x) {
      uint8_t* p = px + y * s->pitch + x * 4;
      if (p[3] > 0 && p[3] < 255) {
        for (int c = 0; c < 3; ++c) p[c] = uint8_t(std::min(255, p[c] * 255 / p[3]));
      }
    }
  }
  return s;
}

SDL_Surface* fromCursor(NSCursor* cursor, int& hotX, int& hotY) {
  if (!cursor || !cursor.image) return nullptr;
  const NSSize size = cursor.image.size;
  SDL_Surface* base = render(cursor.image, size, 1);
  if (!base) return nullptr;
  if (SDL_Surface* dense = render(cursor.image, size, 2)) {
    SDL_AddSurfaceAlternateImage(base, dense);
    SDL_DestroySurface(dense);
  }
  hotX = int(std::lround(cursor.hotSpot.x));
  hotY = int(std::lround(cursor.hotSpot.y));
  return base;
}

}  // namespace

SDL_Surface* nativeCursorImage(CefCursorHandle handle, int& hotX, int& hotY) {
  if (!handle) return nullptr;
  return fromCursor((__bridge NSCursor*)handle, hotX, hotY);
}

SDL_Surface* dragCursorImage(cef_drag_operations_mask_t operation, int& hotX, int& hotY) {
  NSCursor* c = NSCursor.arrowCursor;  // AppKit : la flèche quand rien n'est accepté
  if (operation & DRAG_OPERATION_COPY) c = NSCursor.dragCopyCursor;
  else if (operation & DRAG_OPERATION_LINK) c = NSCursor.dragLinkCursor;
  return fromCursor(c, hotX, hotY);
}

}  // namespace tentacle::platform
