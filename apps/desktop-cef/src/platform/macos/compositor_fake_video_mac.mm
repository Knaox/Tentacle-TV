// Couche vidéo factice : un aplat coloré (CALayer) à la place de la CAMetalLayer de mpv.
// Sert à prouver l'empilement vidéo (dessous) / page (dessus, transparente) sans lecteur.

#import <Cocoa/Cocoa.h>
#import <Metal/Metal.h>
#import <QuartzCore/QuartzCore.h>

#include <SDL3/SDL.h>

#include "compositor/compositor.h"

namespace tentacle {
namespace {

class FakeVideoSurface final : public VideoSurface {
 public:
  FakeVideoSurface(NSWindow* window, uint32_t rgb) : window_(window) {
    layer_ = [CALayer layer];
    layer_.anchorPoint = CGPointZero;
    layer_.actions = @{@"bounds" : [NSNull null], @"position" : [NSNull null],
                       @"hidden" : [NSNull null]};
    CGFloat r = ((rgb >> 16) & 0xff) / 255.0, g = ((rgb >> 8) & 0xff) / 255.0,
            b = (rgb & 0xff) / 255.0;
    layer_.backgroundColor = [NSColor colorWithSRGBRed:r green:g blue:b alpha:1].CGColor;
    layer_.hidden = YES;
  }
  void show() override { layer_.hidden = NO; }
  void hide() override { layer_.hidden = YES; }
  bool visible() const override { return !layer_.hidden; }
  void setFrame(RectPt f) override {
    layer_.frame = CGRectMake(f.x, f.y, f.width, f.height);
    const PixelSize px = pixelSize();
    if ((px.w != last_.w || px.h != last_.h) && onSize_) onSize_(px);
    last_ = px;
  }
  double backingScale() const override { return window_.backingScaleFactor; }
  void* nativeLayer() override { return (__bridge void*)layer_; }
  PixelSize pixelSize() const override {
    const double s = backingScale();
    return {int(layer_.bounds.size.width * s), int(layer_.bounds.size.height * s)};
  }
  int64_t mpvWid() const override { return 0; }  // pas de mpv : aplat seulement
  const char* mpvGpuContext() const override { return ""; }
  SurfaceColorState colorState() const override {
    SurfaceColorState st;
    st.colorspace = "kCGColorSpaceSRGB";
    st.pixelFormat = "CALayer.backgroundColor";
    st.opaque = true;
    return st;
  }
  void onPixelSizeChanged(std::function<void(PixelSize)> cb) override { onSize_ = std::move(cb); }

 private:
  NSWindow* window_;
  CALayer* layer_;
  PixelSize last_;
  std::function<void(PixelSize)> onSize_;
};

// Aplat HDR : une CAMetalLayer née d'emblée en EDR (règle du plan Tentacle : la marge EDR
// est accordée à la naissance de la couche), effacée à `level` (> 1 = au-delà du blanc SDR).
class FakeEdrSurface final : public VideoSurface {
 public:
  FakeEdrSurface(NSWindow* window, float level) : window_(window), level_(level) {
    device_ = MTLCreateSystemDefaultDevice();
    queue_ = [device_ newCommandQueue];
    layer_ = [CAMetalLayer layer];
    layer_.device = device_;
    layer_.pixelFormat = MTLPixelFormatRGBA16Float;
    CGColorSpaceRef cs = CGColorSpaceCreateWithName(kCGColorSpaceExtendedLinearDisplayP3);
    layer_.colorspace = cs;
    CGColorSpaceRelease(cs);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    layer_.wantsExtendedDynamicRangeContent = YES;  // déprécié en 26, toujours honoré
#pragma clang diagnostic pop
    layer_.opaque = YES;
    layer_.anchorPoint = CGPointZero;
    layer_.actions = @{@"bounds" : [NSNull null], @"position" : [NSNull null]};
    layer_.hidden = YES;
  }
  void show() override { layer_.hidden = NO; }
  void hide() override { layer_.hidden = YES; }
  bool visible() const override { return !layer_.hidden; }
  void setFrame(RectPt f) override {
    layer_.frame = CGRectMake(f.x, f.y, f.width, f.height);
    layer_.contentsScale = backingScale();
    const PixelSize px = pixelSize();
    if (px.w <= 0 || px.h <= 0 || (px.w == last_.w && px.h == last_.h)) return;
    last_ = px;
    layer_.drawableSize = CGSizeMake(px.w, px.h);
    fill();
    if (onSize_) onSize_(px);
  }
  double backingScale() const override { return window_.backingScaleFactor; }
  void* nativeLayer() override { return (__bridge void*)layer_; }
  PixelSize pixelSize() const override {
    const double s = backingScale();
    return {int(layer_.bounds.size.width * s), int(layer_.bounds.size.height * s)};
  }
  int64_t mpvWid() const override { return 0; }
  const char* mpvGpuContext() const override { return ""; }
  SurfaceColorState colorState() const override {
    SurfaceColorState st;
    st.colorspace = "kCGColorSpaceExtendedLinearDisplayP3";
    st.pixelFormat = "RGBA16Float";
    st.wantsEdr = true;
    st.opaque = true;
    return st;
  }
  void onPixelSizeChanged(std::function<void(PixelSize)> cb) override { onSize_ = std::move(cb); }

 private:
  void fill() {
    @autoreleasepool {
      id<CAMetalDrawable> d = [layer_ nextDrawable];
      if (!d) return;
      MTLRenderPassDescriptor* pass = [MTLRenderPassDescriptor renderPassDescriptor];
      pass.colorAttachments[0].texture = d.texture;
      pass.colorAttachments[0].loadAction = MTLLoadActionClear;
      pass.colorAttachments[0].storeAction = MTLStoreActionStore;
      pass.colorAttachments[0].clearColor = MTLClearColorMake(level_, level_, level_, 1.0);
      id<MTLCommandBuffer> cb = [queue_ commandBuffer];
      [[cb renderCommandEncoderWithDescriptor:pass] endEncoding];
      [cb presentDrawable:d];
      [cb commit];
    }
  }

  NSWindow* window_;
  float level_;
  id<MTLDevice> device_;
  id<MTLCommandQueue> queue_;
  CAMetalLayer* layer_;
  PixelSize last_;
  std::function<void(PixelSize)> onSize_;
};

NSWindow* windowOf(SDL_Window* window) {
  return (__bridge NSWindow*)SDL_GetPointerProperty(
      SDL_GetWindowProperties(window), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

}  // namespace

std::unique_ptr<VideoSurface> Compositor::createFakeEdrSurface(SDL_Window* window, float level) {
  NSWindow* ns = windowOf(window);
  if (!ns) return nullptr;
  return std::make_unique<FakeEdrSurface>(ns, level);
}

std::unique_ptr<VideoSurface> Compositor::createFakeVideoSurface(SDL_Window* window,
                                                                 uint32_t rgb) {
  NSWindow* ns = (__bridge NSWindow*)SDL_GetPointerProperty(
      SDL_GetWindowProperties(window), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
  if (!ns) return nullptr;
  return std::make_unique<FakeVideoSurface>(ns, rgb);
}

}  // namespace tentacle
