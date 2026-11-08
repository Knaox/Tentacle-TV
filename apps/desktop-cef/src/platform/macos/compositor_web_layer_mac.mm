// Couche web macOS : reçoit les images de CEF (IOSurface du pool de CEF, valable pendant
// l'appel seulement), les COPIE dans une texture à nous (viewTex_), puis compose vue +
// popup dans un drawable de CAMetalLayer transparent (alpha prémultiplié, sRGB).
//
// La référence (ère C++) gardait une texture adossée à l'IOSurface au-delà du rappel : la
// doc de CEF 156 l'interdit (le pool la réutilise → images mêlées). On lit donc la surface
// DANS le rappel, sur le GPU, sans attente CPU (waitUntilCompleted : 5,5 ms par image, pointes
// à 43 ms, mesuré) : comme l'ère 2 de la référence (9954a71), le suivi des dépendances
// IOSurface de Metal entre contextes GPU ordonne notre lecture AVANT tout rendu ultérieur de
// Chromium dans cette surface. TENTACLE_SYNC_COPY=1 rétablit l'attente (comparaison).
// RAM (axe ram) : la vue est dessinée DIRECTEMENT de l'IOSurface vers le drawable ; la copie
// dans viewTex_ (16 Mo en 2560×1600) n'existe que pendant une popup (qui se recompose sans
// nouvelle image de la vue) ou en rendu logiciel.

#import "platform/macos/compositor_mac.h"

#import <IOSurface/IOSurface.h>
#import <Metal/Metal.h>

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <mutex>

namespace tentacle::mac {
namespace {

class WebLayerMac final : public WebLayer {
 public:
  WebLayerMac(CALayer* parent, CompositorStats* stats) : stats_(stats), parent_(parent) {
    device_ = MTLCreateSystemDefaultDevice();
    queue_ = [device_ newCommandQueue];
    makeLayer();
    buildWebPipelines(device_, pipeOpaque_, pipeBlend_);
  }

  // La couche Metal de la page. Détruite quand la page est entièrement transparente (trim), elle
  // renaît à l'image suivante (render) : une couche masquée gardait son image (16 Mo, mesuré).
  void makeLayer() {
    layer_ = [CAMetalLayer layer];
    layer_.device = device_;
    layer_.pixelFormat = MTLPixelFormatBGRA8Unorm;
    CGColorSpaceRef srgb = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    layer_.colorspace = srgb;  // la page est SDR : sRGB, blanc de référence de l'écran
    CGColorSpaceRelease(srgb);
    layer_.opaque = NO;            // transparent : la vidéo passe dessous
    layer_.framebufferOnly = YES;
    // 3 drawables (défaut) : essayé à 2 (−16 Mo pendant les animations), mais une image sautait
    // plus souvent (6 relevés de 120 intervalles sur 15 contre 2 sur 9, bench/mesures/
    // verif-couche.sh). La mémoire se reprend en veille profonde (trim : un seul drawable).
    layer_.anchorPoint = CGPointZero;
    layer_.zPosition = 10;
    layer_.actions = @{@"bounds" : [NSNull null], @"position" : [NSNull null],
                       @"contents" : [NSNull null]};
    layer_.contentsScale = scale_;
    layer_.presentsWithTransaction = liveResize_;
    [parent_ addSublayer:layer_];
  }

  ~WebLayerMac() override {
    [layer_ removeFromSuperlayer];
    if (lastSurface_) CFRelease(lastSurface_);
  }

  void setLiveResize(bool on) {
    liveResize_ = on;
    if (layer_) layer_.presentsWithTransaction = on;
  }

  void fillStats(CompositorStats& s) { fillPresentStats(*present_, s); }

  void setScale(double scale) {
    scale_ = scale;
    if (layer_) layer_.contentsScale = scale;
  }

  void presentView(const WebFrame& f) override {
    id<MTLTexture> view = nil;
    if (f.sharedHandle && !popupVisible_) {
      view = wrap((IOSurfaceRef)f.sharedHandle);
      viewTex_ = nil;
    } else if (copyInto(f, viewTex_)) {
      view = viewTex_;
    }
    if (!view) return;
    stats_->viewFrames++;
    stats_->viewPixels += uint64_t(view.width) * view.height;
    stats_->dirtyPixels += f.dirtyPixels >= 0 ? uint64_t(f.dirtyPixels) : uint64_t(view.width) * view.height;
    if ((int)view.width != viewW_ || (int)view.height != viewH_) stats_->viewSizeChanges++;
    viewW_ = (int)view.width;
    viewH_ = (int)view.height;
    keepForSampling(f);
    render(view);
  }

  void presentPopup(const WebFrame& f) override {
    if (!copyInto(f, popupTex_)) return;
    stats_->popupFrames++;
    if (viewTex_) render(viewTex_);  // sinon : la prochaine image de la vue (Invalidate)
  }

  void setPopup(bool visible, PopupRect rect) override {
    popupVisible_ = visible;
    popupRect_ = rect;
    if (!visible) popupTex_ = viewTex_ = nil;  // la vue se redessine seule (Invalidate)
    if (viewTex_) render(viewTex_);
  }

  bool samplePixel(int x, int y, uint8_t bgra[4]) override {
    if (x < 0 || y < 0 || x >= viewW_ || y >= viewH_) return false;
    if (lastSurface_ && !viewTex_) {  // dernière IOSurface reçue, lue par le CPU (diagnostic)
      IOSurfaceLock(lastSurface_, kIOSurfaceLockReadOnly, nullptr);
      const auto* base = (const uint8_t*)IOSurfaceGetBaseAddress(lastSurface_);
      std::memcpy(bgra, base + y * IOSurfaceGetBytesPerRow(lastSurface_) + x * 4, 4);
      IOSurfaceUnlock(lastSurface_, kIOSurfaceLockReadOnly, nullptr);
      return true;
    }
    if (!viewTex_) return false;
    [viewTex_ getBytes:bgra bytesPerRow:4 fromRegion:MTLRegionMake2D(x, y, 1, 1) mipmapLevel:0];
    return true;
  }

 private:

  bool ensureTexture(id<MTLTexture> __strong& tex, int w, int h) {
    if (tex && (int)tex.width == w && (int)tex.height == h) return true;
    MTLTextureDescriptor* d =
        [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
                                                           width:w height:h mipmapped:NO];
    d.usage = MTLTextureUsageShaderRead;
    d.storageMode = MTLStorageModeShared;  // lisible par samplePixel (diagnostic)
    tex = [device_ newTextureWithDescriptor:d];
    return tex != nil;
  }

  id<MTLTexture> wrap(IOSurfaceRef surface) {
    MTLTextureDescriptor* d = [MTLTextureDescriptor
        texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
                                     width:IOSurfaceGetWidth(surface)
                                    height:IOSurfaceGetHeight(surface) mipmapped:NO];
    d.usage = MTLTextureUsageShaderRead;
    return [device_ newTextureWithDescriptor:d iosurface:surface plane:0];
  }

  void keepForSampling(const WebFrame& f) {
    // Référence sur la surface du pool (pas de mémoire en plus : le pool la garde déjà).
    if (lastSurface_) CFRelease(lastSurface_);
    lastSurface_ = f.sharedHandle ? (IOSurfaceRef)CFRetain((IOSurfaceRef)f.sharedHandle) : nullptr;
  }

  bool copyInto(WebFrame f, id<MTLTexture> __strong& dst) {
    if (f.sharedHandle) {  // la taille fait foi côté IOSurface (coded_size peut être arrondi)
      f.width = (int)IOSurfaceGetWidth((IOSurfaceRef)f.sharedHandle);
      f.height = (int)IOSurfaceGetHeight((IOSurfaceRef)f.sharedHandle);
    }
    if (f.width <= 0 || f.height <= 0 || !ensureTexture(dst, f.width, f.height)) return false;
    if (f.pixels) {
      [dst replaceRegion:MTLRegionMake2D(0, 0, f.width, f.height) mipmapLevel:0
               withBytes:f.pixels bytesPerRow:f.stride];
      return true;
    }
    if (!f.sharedHandle) return false;
    auto t0 = std::chrono::steady_clock::now();
    id<MTLTexture> src = wrap((IOSurfaceRef)f.sharedHandle);
    if (!src) return false;
    id<MTLCommandBuffer> cb = [queue_ commandBuffer];
    id<MTLBlitCommandEncoder> blit = [cb blitCommandEncoder];
    [blit copyFromTexture:src toTexture:dst];
    [blit endEncoding];
    CompositorStats* stats = stats_;
    [cb addCompletedHandler:^(id<MTLCommandBuffer> done) {
      stats->lastGpuCopyMs = (done.GPUEndTime - done.GPUStartTime) * 1000.0;
    }];
    [cb commit];
    if (syncCopy_) [cb waitUntilCompleted];
    double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0)
                    .count();
    stats_->lastCopyMs = ms;
    if (ms > stats_->maxCopyMs) stats_->maxCopyMs = ms;
    return true;
  }

  void trim() override {
    // Changer drawableSize fait jeter à la couche ses drawables de réserve ; celui qui est à
    // l'écran reste son contenu. La prochaine image remet la taille (render).
    if (trimmed_ || !viewW_ || !layer_) return;
    trimmed_ = true;
    // Page entièrement transparente (lecture vidéo, commandes masquées) : rien à montrer. La
    // couche quitte l'arbre (WindowServer ne compose plus rien au-dessus de la vidéo) avec son
    // image affichée ; elle renaît à l'image suivante.
    if (!popupVisible_ && lastSurface_ && surfaceFullyTransparent(lastSurface_)) {
      [CATransaction begin];
      [CATransaction setDisableActions:YES];
      [layer_ removeFromSuperlayer];
      [CATransaction commit];
      layer_ = nil;
      return;
    }
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    layer_.drawableSize = CGSizeMake(1, 1);
    [CATransaction commit];
  }

  void render(id<MTLTexture> view) {
    const int w = (int)view.width, h = (int)view.height;
    trimmed_ = false;
    if (!layer_) makeLayer();
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    // La couche suit la taille de l'image reçue (pas celle de la fenêtre) : pendant un
    // redimensionnement l'ancienne image reste nette en haut à gauche, sans étirement.
    layer_.frame = CGRectMake(0, 0, w / scale_, h / scale_);
    layer_.drawableSize = CGSizeMake(w, h);
    [CATransaction commit];
    @autoreleasepool {
      id<CAMetalDrawable> drawable = [layer_ nextDrawable];
      if (!drawable) return;
      MTLRenderPassDescriptor* pass = [MTLRenderPassDescriptor renderPassDescriptor];
      pass.colorAttachments[0].texture = drawable.texture;
      pass.colorAttachments[0].loadAction = MTLLoadActionClear;
      pass.colorAttachments[0].clearColor = MTLClearColorMake(0, 0, 0, 0);
      pass.colorAttachments[0].storeAction = MTLStoreActionStore;
      id<MTLCommandBuffer> cb = [queue_ commandBuffer];
      id<MTLRenderCommandEncoder> enc = [cb renderCommandEncoderWithDescriptor:pass];
      int origin[2] = {0, 0};
      [enc setRenderPipelineState:pipeOpaque_];
      [enc setFragmentTexture:view atIndex:0];
      [enc setFragmentBytes:origin length:sizeof(origin) atIndex:0];
      [enc drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:0 vertexCount:3];
      if (popupVisible_ && popupTex_) {
        origin[0] = popupRect_.x;
        origin[1] = popupRect_.y;
        [enc setRenderPipelineState:pipeBlend_];
        [enc setFragmentTexture:popupTex_ atIndex:0];
        [enc setFragmentBytes:origin length:sizeof(origin) atIndex:0];
        [enc drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:0 vertexCount:3];
      }
      [enc endEncoding];
      std::shared_ptr<PresentLog> log = present_;
      [drawable addPresentedHandler:^(id<MTLDrawable> d) {
        if (d.presentedTime > 0) log->add(d.presentedTime);
      }];
      if (liveResize_) {
        // Présentation dans la transaction CA courante : contenu et cadre de la fenêtre
        // changent ensemble (référence ère 1 : presentsWithTransaction au resize).
        stats_->liveResizeFrames++;
        [cb commit];
        [cb waitUntilScheduled];
        [drawable present];
      } else {
        [cb presentDrawable:drawable];
        [cb commit];
      }
      if (syncCopy_) [cb waitUntilCompleted];
    }
  }

  CompositorStats* stats_;
  CALayer* parent_ = nil;
  id<MTLDevice> device_ = nil;
  id<MTLCommandQueue> queue_ = nil;
  CAMetalLayer* layer_ = nil;
  id<MTLRenderPipelineState> pipeOpaque_ = nil, pipeBlend_ = nil;
  id<MTLTexture> viewTex_ = nil, popupTex_ = nil;
  IOSurfaceRef lastSurface_ = nullptr;
  int viewW_ = 0, viewH_ = 0;
  bool popupVisible_ = false;
  bool trimmed_ = false;
  bool syncCopy_ = getenv("TENTACLE_SYNC_COPY") != nullptr;
  bool liveResize_ = false;
  std::shared_ptr<PresentLog> present_ = std::make_shared<PresentLog>();
  PopupRect popupRect_;
  double scale_ = 1.0;
};

}  // namespace

std::unique_ptr<WebLayer> createWebLayer(CALayer* parent, CompositorStats* stats) {
  return std::make_unique<WebLayerMac>(parent, stats);
}

void webLayerSetLiveResize(WebLayer* layer, bool on) {
  static_cast<WebLayerMac*>(layer)->setLiveResize(on);
}

void webLayerFillStats(WebLayer* layer, CompositorStats& stats) {
  static_cast<WebLayerMac*>(layer)->fillStats(stats);
}

void webLayerSetScale(WebLayer* layer, double scale) {
  static_cast<WebLayerMac*>(layer)->setScale(scale);
}

}  // namespace tentacle::mac
