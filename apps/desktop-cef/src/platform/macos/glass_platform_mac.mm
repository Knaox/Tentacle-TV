// La couture macOS du verre natif : le verdict (version, classes publiques), la machine (Apple
// Silicon : verre du lecteur), et la page sous les rectangles de `liquidGlass.sample`.

#import <AppKit/AppKit.h>
#import <IOSurface/IOSurface.h>

#include <dispatch/dispatch.h>

#include <cmath>

#include "compositor/compositor.h"
#include "glass/glass_platform.h"
#include "shell/main_thread.h"

namespace tentacle::glass::platform {

const char* name() { return "darwin"; }

std::string systemVersion() {
  const NSOperatingSystemVersion v = NSProcessInfo.processInfo.operatingSystemVersion;
  return std::to_string(v.majorVersion) + "." + std::to_string(v.minorVersion) + "." + std::to_string(v.patchVersion);
}

RuntimeProbe probeRuntime() {
  // La seule preuve qui vaille : la classe est là, à l'exécution (un numéro de version se lit de
  // travers). AppKit est lié au binaire : rien à charger, jamais `load-failed`.
  const bool present = NSClassFromString(@"NSGlassEffectView") != nil &&
                       NSClassFromString(@"NSGlassEffectContainerView") != nil;
  return present ? RuntimeProbe::Ok : RuntimeProbe::MissingClass;
}

bool refractsVideo() {
  // Le montage `fenetre` d'Electron : Apple Silicon. Sur Intel, décision du lot Liquid Glass :
  // pas de verre du lecteur (GPU intégrés déjà chauds en lecture, aucun HDR à y gagner).
#if defined(__arm64__) || defined(__aarch64__)
  return true;
#else
  return false;
#endif
}

void readPageGrids(Compositor* compositor, double viewWidthPt, std::vector<std::optional<Box>> boxes,
                   std::function<void(Grids)> done) {
  bool wanted = false;
  for (const auto& b : boxes) wanted = wanted || b.has_value();
  WebLayer* web = compositor ? compositor->webLayer() : nullptr;
  IOSurfaceRef surface = wanted && web ? (IOSurfaceRef)web->retainLastFrame() : nullptr;
  if (surface == nullptr || !(viewWidthPt > 0)) {
    if (surface) CFRelease(surface);
    return done(Grids(boxes.size()));
  }
  // Lecture HORS du fil principal : verrouiller une IOSurface attend la fin du rendu GPU qui
  // l'écrit. Une seule lecture de quelques centaines de points par rectangle, jamais l'image.
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    Grids grids(boxes.size());
    if (IOSurfaceLock(surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess) {
      const auto* base = static_cast<const uint8_t*>(IOSurfaceGetBaseAddress(surface));
      const int width = static_cast<int>(IOSurfaceGetWidth(surface));
      const int height = static_cast<int>(IOSurfaceGetHeight(surface));
      const size_t stride = IOSurfaceGetBytesPerRow(surface);
      // L'échelle se déduit de l'image, jamais d'une échelle supposée (Retina, autre écran).
      const double scale = width / viewWidthPt;
      for (size_t k = 0; k < boxes.size(); ++k) {
        if (!boxes[k]) continue;
        const Box& b = *boxes[k];
        grids[k] = gridSamples(base, width, height, {b.x * scale, b.y * scale, b.width * scale, b.height * scale},
                               kSampleGrid, stride);
      }
      IOSurfaceUnlock(surface, kIOSurfaceLockReadOnly, nullptr);
    }
    CFRelease(surface);
    auto shared = std::make_shared<Grids>(std::move(grids));
    postToMain([done, shared] { done(std::move(*shared)); });
  });
}

}  // namespace tentacle::glass::platform
