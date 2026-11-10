#pragma once
// Pièces macOS internes au compositeur (non exposées hors de src/platform/macos/compositor*).
#ifdef __OBJC__
#import <Cocoa/Cocoa.h>
#import <IOSurface/IOSurface.h>
#import <Metal/Metal.h>
#import <QuartzCore/QuartzCore.h>
#endif

#include <cstdint>
#include <memory>
#include <mutex>

#include "compositor/compositor.h"

namespace tentacle::mac {

// Horodatages de présentation (presentedTime), écrits depuis le fil de Metal.
struct PresentLog {
  std::mutex m;
  double times[256] = {};
  uint64_t count = 0;
  void add(double t) {
    std::lock_guard<std::mutex> l(m);
    times[count++ % 256] = t;
  }
};

// Statistiques de présentation (fenêtre glissante) à partir du journal.
void fillPresentStats(PresentLog& log, CompositorStats& s);

#ifdef __OBJC__
// Couche web : CAMetalLayer transparente qui reçoit les IOSurface de CEF.
std::unique_ptr<WebLayer> createWebLayer(CALayer* parent, CompositorStats* stats);
// Repositionne la couche web (taille en points, échelle) — appelé par le compositeur.
void webLayerSetScale(WebLayer* layer, double scale);
// Redimensionnement en direct : présentation synchronisée avec la transaction Core Animation.
void webLayerSetLiveResize(WebLayer* layer, bool on);
// Complète les statistiques de présentation (fil principal).
void webLayerFillStats(WebLayer* layer, CompositorStats& stats);
// Page entièrement transparente (alpha nul partout) dans cette IOSurface BGRA ?
bool surfaceFullyTransparent(IOSurfaceRef surface);
// Une pile de couches dans une NSWindow quelconque (la fenêtre PiP : `transparent`, rien sous
// la page que la vidéo prêtée).
std::unique_ptr<Compositor> createCompositor(NSWindow* window, bool transparent);
// Pipelines de la couche web (compositor_web_pipeline_mac.mm).
void buildWebPipelines(id<MTLDevice> device, id<MTLRenderPipelineState> __strong& opaque,
                       id<MTLRenderPipelineState> __strong& blend);
#endif

}  // namespace tentacle::mac
