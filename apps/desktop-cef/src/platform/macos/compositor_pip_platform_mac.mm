// macOS : ce que le PiP demande au bureau — écrans, curseur, fenêtre principale, horloge,
// « Réduire les animations » — et la fabrique de sa fenêtre native.

#import <QuartzCore/QuartzCore.h>

#import "platform/macos/compositor_mac.h"
#import "platform/macos/compositor_pip_mac.h"
#include "pip/pip_platform.h"
#include "pip/sdl/pip_sdl.h"

#include <SDL3/SDL.h>

#include <cstdio>
#include <cstring>

#include <cmath>
#include <map>

using namespace tentacle::pip;

/// Une minuterie répétée dans les modes « communs » de la boucle : elle tourne aussi pendant
/// un redimensionnement en direct ou un menu ouvert.
@interface TentaclePipTimer : NSObject
@property(nonatomic) std::function<void()> tick;
- (void)fire:(NSTimer*)timer;
@end
@implementation TentaclePipTimer
- (void)fire:(NSTimer*)timer {
  if (_tick) _tick();
}
@end

namespace tentacle::pip {
namespace {

using mac::fromAppKit;

double area(const Box& a, const Box& b) {
  const double w = std::min(a.x + a.width, b.x + b.width) - std::max(a.x, b.x);
  const double h = std::min(a.y + a.height, b.y + b.height) - std::max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

double distanceTo(const Box& b, Point p) {
  const double dx = std::max({b.x - p.x, 0.0, p.x - (b.x + b.width)});
  const double dy = std::max({b.y - p.y, 0.0, p.y - (b.y + b.height)});
  return std::hypot(dx, dy);
}

class MacTicker final : public Ticker {
 public:
  std::function<void()> every(double intervalMs, std::function<void()> tick) override {
    TentaclePipTimer* target = [TentaclePipTimer new];
    target.tick = std::move(tick);
    NSTimer* timer = [NSTimer timerWithTimeInterval:intervalMs / 1000.0
                                             target:target
                                           selector:@selector(fire:)
                                           userInfo:nil
                                            repeats:YES];
    timer.tolerance = 0;
    [NSRunLoop.mainRunLoop addTimer:timer forMode:NSRunLoopCommonModes];
    return [timer, target] {
      target.tick = nullptr;
      [timer invalidate];
    };
  }
  double nowMs() override { return CACurrentMediaTime() * 1000.0; }
};

class MacDesktop final : public Desktop {
 public:
  explicit MacDesktop(NSWindow* host) : host_(host) {}

  Point cursor() override {
    const NSPoint p = NSEvent.mouseLocation;
    return {p.x, NSScreen.screens.firstObject.frame.size.height - p.y};
  }

  Box workAreaNearest(Point point) override {
    NSScreen* best = nil;
    double bestDistance = INFINITY;
    for (NSScreen* s in NSScreen.screens) {
      const double d = distanceTo(fromAppKit(s.frame), point);
      if (d < bestDistance) bestDistance = d, best = s;
    }
    return fromAppKit((best ?: NSScreen.mainScreen).visibleFrame);
  }
  Box workAreaMatching(const Box& box) override { return fromAppKit(matching(box).visibleFrame); }
  Box displayBoundsMatching(const Box& box) override { return fromAppKit(matching(box).frame); }

  Box hostContentBounds() override {
    if (!host_) return {};
    return fromAppKit([host_ contentRectForFrameRect:host_.frame]);
  }
  Box hostBounds() override { return host_ ? fromAppKit(host_.frame) : Box{}; }

  // Le bandeau du lecteur sous une barre de titre intégrée (macosTitleBar.ts : 38 − 16) ; avec
  // la barre standard, la zone de contenu commence déjà dessous.
  double bannerInset() override {
    if (!host_) return 0;
    const NSWindowStyleMask m = host_.styleMask;
    if ((m & NSWindowStyleMaskFullScreen) || !(m & NSWindowStyleMaskFullSizeContentView)) return 0;
    return 38 - 16;
  }

  bool reducedMotion() override {
    return NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion;
  }

 private:
  NSScreen* matching(const Box& box) {
    NSScreen* best = host_.screen ?: NSScreen.mainScreen;
    double bestArea = 0;
    for (NSScreen* s in NSScreen.screens) {
      const double a = area(fromAppKit(s.frame), box);
      if (a > bestArea) bestArea = a, best = s;
    }
    return best;
  }

  __weak NSWindow* host_;
};

class MacPlatform final : public Platform {
 public:
  explicit MacPlatform(NSWindow* host) : host_(host), desktop_(host) {}
  Desktop& desktop() override { return desktop_; }
  Ticker& ticker() override { return ticker_; }
  std::unique_ptr<Window> createWindow(const Box& box, Mode mode, const std::string& caption,
                                       PageInput input) override {
    return mac::createWindow(host_, box, mode, caption, std::move(input));
  }
  void setCursor(Window& window, int type) override { mac::setWindowCursor(window, type); }
  // Comme `BrowserWindow.focus()` d'Electron — jamais une fenêtre réduite, cachée ou ailleurs.
  void focusHost() override {
    NSWindow* host = host_;
    if (!host || host.miniaturized || !host.visible || !host.onActiveSpace) return;
    [NSApp activateIgnoringOtherApps:NO];
    [host makeKeyAndOrderFront:nil];
  }

 private:
  __weak NSWindow* host_;
  MacDesktop desktop_;
  MacTicker ticker_;
};

}  // namespace

std::unique_ptr<Platform> createPlatform(SDL_Window* sdlHost, void* nativeHost, Compositor* hostStack) {
  NSWindow* host = (__bridge NSWindow*)nativeHost;
  if (![host isKindOfClass:NSWindow.class] || !hostStack || !hostStack->canLendVideo()) return nullptr;
  // Banc : la fenêtre PiP PORTABLE (SDL3, celle de Linux et Windows) éprouvée ici, sur la même
  // pile de couches macOS. L'app livrée garde la fenêtre native (compositor_pip_window_mac.mm).
  if (const char* host_kind = getenv("TENTACLE_PIP_HOST"); host_kind && !strcmp(host_kind, "sdl")) {
    sdl::Options o;
    o.makeStack = [](SDL_Window* pip) {
      NSWindow* ns = (__bridge NSWindow*)SDL_GetPointerProperty(
          SDL_GetWindowProperties(pip), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
      return tentacle::mac::createCompositor(ns, /*transparent=*/true);
    };
    std::fprintf(stderr, "[pip] fenêtre PiP SDL (banc)\n");
    return sdl::createPlatform(sdlHost, std::move(o));
  }
  // Aucun montage à part sur CEF : la vidéo est NOTRE couche, sur Apple Silicon comme sur
  // Intel ; elle change de pile sans que mpv le sache (Compositor::lendVideo).
  return std::make_unique<MacPlatform>(host);
}

}  // namespace tentacle::pip
