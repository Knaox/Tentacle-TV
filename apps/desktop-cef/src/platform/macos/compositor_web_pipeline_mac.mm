// Pièces de la couche web : pipelines Metal (vue opaque 1:1, popup en « source over »
// prémultiplié) et statistiques de présentation.

#import "platform/macos/compositor_mac.h"

#import <IOSurface/IOSurface.h>
#import <Metal/Metal.h>

#include <algorithm>

namespace tentacle::mac {
namespace {

NSString* const kShaders = @R"(
#include <metal_stdlib>
using namespace metal;
struct VOut { float4 pos [[position]]; };
vertex VOut vmain(uint vid [[vertex_id]]) {
  float2 p[3] = { float2(-1.0, -1.0), float2(3.0, -1.0), float2(-1.0, 3.0) };
  VOut o; o.pos = float4(p[vid], 0.0, 1.0); return o;
}
// Lecture 1:1 (pas de filtrage) : la texture a déjà la taille du drawable.
fragment float4 fmain(VOut in [[stage_in]], texture2d<float> t [[texture(0)]],
                      constant int2& origin [[buffer(0)]]) {
  int2 c = int2(in.pos.xy) - origin;
  if (c.x < 0 || c.y < 0 || c.x >= int(t.get_width()) || c.y >= int(t.get_height()))
    return float4(0.0);
  return t.read(uint2(c));
}
)";

}  // namespace

void buildWebPipelines(id<MTLDevice> device, id<MTLRenderPipelineState> __strong& opaque,
                       id<MTLRenderPipelineState> __strong& blend) {
  NSError* err = nil;
  id<MTLLibrary> lib = [device newLibraryWithSource:kShaders options:nil error:&err];
  MTLRenderPipelineDescriptor* d = [MTLRenderPipelineDescriptor new];
  d.vertexFunction = [lib newFunctionWithName:@"vmain"];
  d.fragmentFunction = [lib newFunctionWithName:@"fmain"];
  d.colorAttachments[0].pixelFormat = MTLPixelFormatBGRA8Unorm;
  opaque = [device newRenderPipelineStateWithDescriptor:d error:&err];
  // Popup : « source over » en alpha prémultiplié (Chromium livre du prémultiplié).
  d.colorAttachments[0].blendingEnabled = YES;
  d.colorAttachments[0].sourceRGBBlendFactor = MTLBlendFactorOne;
  d.colorAttachments[0].sourceAlphaBlendFactor = MTLBlendFactorOne;
  d.colorAttachments[0].destinationRGBBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
  d.colorAttachments[0].destinationAlphaBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
  blend = [device newRenderPipelineStateWithDescriptor:d error:&err];
  if (!opaque || !blend) NSLog(@"[compositor] pipeline Metal : %@", err);
}


void fillPresentStats(PresentLog& log, CompositorStats& s) {
  std::lock_guard<std::mutex> l(log.m);
  s.presentedFrames = log.count;
  const uint64_t n = std::min<uint64_t>(log.count, 256);
  if (n < 2) return;
  const double last = log.times[(log.count - 1) % 256];
  double sum = 0, mx = 0;
  int intervals = 0, inLastSecond = 0;
  for (uint64_t i = 0; i < n; ++i) {
    const double t = log.times[(log.count - 1 - i) % 256];
    if (last - t < 1.0) inLastSecond++;
    if (i + 1 < n && i < 120) {
      const double d = t - log.times[(log.count - 2 - i) % 256];
      sum += d;
      mx = std::max(mx, d);
      intervals++;
    }
  }
  // Rien de présenté depuis plus d'une seconde : la page est au repos.
  const double age = CACurrentMediaTime() - last;
  s.presentedFps = age > 1.0 ? 0 : inLastSecond;
  s.presentIntervalMeanMs = intervals ? sum / intervals * 1000.0 : 0;
  s.presentIntervalMaxMs = mx * 1000.0;
}

bool surfaceFullyTransparent(IOSurfaceRef surface) {
  // BGRA prémultiplié : l'alpha est l'octet 3 de chaque pixel ; 2 pixels par mot de 64 bits.
  // 2560×1600 : 16 Mo lus une fois, à l'entrée en veille profonde (~1–2 ms).
  if (IOSurfaceLock(surface, kIOSurfaceLockReadOnly, nullptr) != kIOReturnSuccess) return false;
  const auto* base = (const uint8_t*)IOSurfaceGetBaseAddress(surface);
  const size_t rowBytes = IOSurfaceGetBytesPerRow(surface), w = IOSurfaceGetWidth(surface);
  const size_t h = IOSurfaceGetHeight(surface), words = w / 2;
  bool clear = base != nullptr;
  for (size_t y = 0; clear && y < h; ++y) {
    const auto* row = (const uint64_t*)(base + y * rowBytes);
    uint64_t any = 0;
    for (size_t i = 0; i < words; ++i) any |= row[i];
    if (w & 1) any |= (uint64_t)((const uint32_t*)row)[w - 1];
    clear = (any & 0xFF000000FF000000ull) == 0;
  }
  IOSurfaceUnlock(surface, kIOSurfaceLockReadOnly, nullptr);
  return clear;
}

}  // namespace tentacle::mac
