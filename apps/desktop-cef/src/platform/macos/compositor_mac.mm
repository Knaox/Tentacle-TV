// Compositeur macOS : une vue « hôte de couches » posée au-dessus de la vue de contenu de
// SDL. Elle ne prend aucun clic (hitTest → nil) : la saisie reste à SDL. Dans sa couche :
//   videoContainer (zPosition 0)  ← CAMetalLayer de la vidéo (VideoSurface::nativeLayer)
//   webLayer       (zPosition 10) ← CAMetalLayer transparente de la page CEF
// Core Animation compose les deux ; la page laisse voir la vidéo là où alpha < 1.
// Pourquoi pas une seule couche Metal où l'on mélangerait vidéo + page (référence ère 1,
// « overlay » OpenGL/Metal) : l'EDR est accordé par couche, à la couche HDR elle-même ; la
// garder intacte (née en PQ, composée par le système) est la voie sans bidouille.

#import "platform/macos/compositor_mac.h"

#import <IOSurface/IOSurface.h>

#include <SDL3/SDL.h>

@interface TentacleLayerHostView : NSView
@end

@implementation TentacleLayerHostView
- (NSView*)hitTest:(NSPoint)point {
  return nil;  // transparent à la souris : SDL reçoit tout
}
- (BOOL)acceptsFirstResponder {
  return NO;
}
@end

namespace tentacle {
namespace {

NSDictionary* noActions() {
  return @{@"bounds" : [NSNull null], @"position" : [NSNull null], @"frame" : [NSNull null],
           @"contents" : [NSNull null], @"hidden" : [NSNull null], @"sublayers" : [NSNull null]};
}

class CompositorMac final : public Compositor {
 public:
  explicit CompositorMac(NSWindow* window) {
    NSView* content = window.contentView;
    host_ = [[TentacleLayerHostView alloc] initWithFrame:content.bounds];
    root_ = [CALayer layer];
    root_.geometryFlipped = YES;  // origine en haut à gauche, comme CEF et SDL
    root_.actions = noActions();
    root_.backgroundColor = CGColorGetConstantColor(kCGColorBlack);
    host_.layer = root_;  // vue hôte de couches : la couche est à nous, AppKit n'y dessine pas
    host_.wantsLayer = YES;
    host_.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    content.wantsLayer = YES;
    [content addSubview:host_ positioned:NSWindowAbove relativeTo:nil];

    videoContainer_ = [CALayer layer];
    videoContainer_.actions = noActions();
    videoContainer_.zPosition = 0;
    videoContainer_.anchorPoint = CGPointZero;
    [root_ addSublayer:videoContainer_];

    web_ = mac::createWebLayer(root_, &stats_);
    // Pendant le redimensionnement en direct, la page doit changer de taille dans la MÊME
    // transaction que la fenêtre (sinon bords vides/décalés d'une image).
    NSNotificationCenter* nc = NSNotificationCenter.defaultCenter;
    WebLayer* web = web_.get();
    observers_ = @[
      [nc addObserverForName:NSWindowWillStartLiveResizeNotification object:window queue:nil
                  usingBlock:^(NSNotification*) { mac::webLayerSetLiveResize(web, true); }],
      [nc addObserverForName:NSWindowDidEndLiveResizeNotification object:window queue:nil
                  usingBlock:^(NSNotification*) { mac::webLayerSetLiveResize(web, false); }],
    ];
    resize(content.bounds.size.width, content.bounds.size.height, window.backingScaleFactor);
  }

  ~CompositorMac() override {
    for (id o in observers_) [NSNotificationCenter.defaultCenter removeObserver:o];
    setVideoLayer(nullptr);
    web_.reset();
    [host_ removeFromSuperview];
  }

  void setVideoLayer(VideoSurface* surface) override {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    if (video_) {
      CALayer* old = (__bridge CALayer*)video_->nativeLayer();
      [old removeFromSuperlayer];
    }
    video_ = surface;
    if (video_) {
      CALayer* layer = (__bridge CALayer*)video_->nativeLayer();
      [videoContainer_ addSublayer:layer];
      video_->setFrame({0, 0, width_, height_});
      video_->show();
    }
    [CATransaction commit];
  }

  WebLayer* webLayer() override { return web_.get(); }

  void resize(double widthPt, double heightPt, double scale) override {
    width_ = widthPt;
    height_ = heightPt;
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    root_.contentsScale = scale;
    videoContainer_.frame = CGRectMake(0, 0, widthPt, heightPt);
    if (video_) video_->setFrame({0, 0, widthPt, heightPt});
    mac::webLayerSetScale(web_.get(), scale);
    [CATransaction commit];
  }

  CompositorStats stats() const override {
    CompositorStats s = stats_;
    mac::webLayerFillStats(web_.get(), s);
    return s;
  }

  std::string describeLayers() const override {
    NSMutableString* out = [NSMutableString string];
    describe(root_, 0, out);
    return out.UTF8String;
  }

 private:
  static void describe(CALayer* l, int depth, NSMutableString* out) {
    // contents : ce que Core Animation affiche réellement (IOSurface présentée, ou rien).
    NSString* contents = l.contents ? NSStringFromClass([l.contents class]) : @"-";
    if (l.contents && CFGetTypeID((__bridge CFTypeRef)l.contents) == IOSurfaceGetTypeID()) {
      IOSurfaceRef surface = (__bridge IOSurfaceRef)l.contents;
      contents = [NSString stringWithFormat:@"IOSurface %zux%zu", IOSurfaceGetWidth(surface),
                                            IOSurfaceGetHeight(surface)];
    }
    if ([l isKindOfClass:CAMetalLayer.class]) {
      const CGSize d = ((CAMetalLayer*)l).drawableSize;
      contents = [contents stringByAppendingFormat:@" drawable=%.0fx%.0f", d.width, d.height];
    }
    [out appendFormat:@"%*s%@ z=%.0f hidden=%d opaque=%d frame=%@ scale=%.1f contents=%@%@\n",
                      depth * 2, "", NSStringFromClass(l.class), l.zPosition, l.hidden, l.opaque,
                      NSStringFromRect(NSRectFromCGRect(l.frame)), l.contentsScale, contents,
                      l.backgroundColor ? @" fond" : @""];
    for (CALayer* c in l.sublayers) describe(c, depth + 1, out);
  }

  TentacleLayerHostView* host_ = nil;
  NSArray* observers_ = nil;
  CALayer* root_ = nil;
  CALayer* videoContainer_ = nil;
  std::unique_ptr<WebLayer> web_;
  VideoSurface* video_ = nullptr;
  double width_ = 0, height_ = 0;
  CompositorStats stats_;
};

}  // namespace

std::unique_ptr<Compositor> Compositor::create(SDL_Window* window) {
  SDL_PropertiesID props = SDL_GetWindowProperties(window);
  NSWindow* ns = (__bridge NSWindow*)SDL_GetPointerProperty(
      props, SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
  if (!ns) return nullptr;
  return std::make_unique<CompositorMac>(ns);
}

}  // namespace tentacle
