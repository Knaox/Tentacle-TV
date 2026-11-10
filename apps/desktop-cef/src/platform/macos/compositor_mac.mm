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

#include <algorithm>

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
  // `transparent` : la pile de la fenêtre PiP — rien sous la page que la vidéo prêtée, le
  // bureau se voit autour (la marge d'ombre du cadre).
  explicit CompositorMac(NSWindow* window, bool transparent = false) : window_(window) {
    NSView* content = window.contentView;
    host_ = [[TentacleLayerHostView alloc] initWithFrame:content.bounds];
    root_ = [CALayer layer];
    root_.geometryFlipped = YES;  // origine en haut à gauche, comme CEF et SDL
    root_.actions = noActions();
    root_.backgroundColor = transparent ? nil : CGColorGetConstantColor(kCGColorBlack);
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
    setUnderlay(nullptr);
    setVideoLayer(nullptr);
    web_.reset();
    [host_ removeFromSuperview];
  }

  void setVideoLayer(VideoSurface* surface) override {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    if (borrower_) {
      // Prêtée (PiP) : une vraie couche va chez l'emprunteur ; la couche du repos reste ici.
      const bool lend = surface && surface != home_;
      if (!lend) borrower_->setVideoLayer(nullptr);
      if (shown_) detach(shown_);
      video_ = surface;
      if (lend) borrower_->setVideoLayer(surface);
      else if (surface) attach(surface);
    } else {
      if (video_) detach(video_);
      video_ = surface;
      if (video_) attach(video_);
    }
    [CATransaction commit];
  }

  bool canLendVideo() const override { return true; }

  bool lendVideo(Compositor* borrower, VideoSurface* home) override {
    if (!borrower || borrower == this) return false;
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    borrower_ = borrower;
    home_ = home;
    VideoSurface* current = video_;
    if (current && current != home_) {
      detach(current);
      borrower_->setVideoLayer(current);  // la MÊME couche : mpv y dessine sans le savoir
    }
    [CATransaction commit];
    return true;
  }

  void reclaimVideo() override {
    if (!borrower_) return;
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    borrower_->setVideoLayer(nullptr);
    borrower_ = nullptr;
    home_ = nullptr;
    if (shown_) detach(shown_);
    if (video_) attach(video_);
    [CATransaction commit];
  }

  void setVideoInset(double inset) override {
    inset_ = inset;
    if (shown_) shown_->setFrame(videoFrame());
  }

  // Verre natif (axe verre) : sous-vue de l'hôte de couches — sa couche rejoint la pile, entre
  // la vidéo (z 0) et la page (z 10). Mesuré (maquette, macOS 26.6) : le verre réfracte la vidéo
  // et la page passe par-dessus ; AppKit place ses verres à leur cadre (origine en bas).
  bool setUnderlay(void* view) override {
    NSView* next = (__bridge NSView*)view;
    if (underlay_ == next) return true;
    if (underlay_) [underlay_ removeFromSuperview];
    underlay_ = next;
    if (!next) return true;
    next.frame = host_.bounds;
    next.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    next.wantsLayer = YES;
    [host_ addSubview:next];
    next.layer.zPosition = 5;
    return true;
  }

  bool shownVideoFrame(RectPt* frame) const override {
    if (!shown_) return false;
    if (frame) *frame = videoFrame();
    return true;
  }

  WebLayer* webLayer() override { return web_.get(); }

  void resize(double widthPt, double heightPt, double scale) override {
    width_ = widthPt;
    height_ = heightPt;
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    root_.contentsScale = scale;
    videoContainer_.frame = CGRectMake(0, 0, widthPt, heightPt);
    if (shown_) shown_->setFrame(videoFrame());
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

  // Le cadre de la vidéo : plein cadre, ou à `inset_` des bords (pile du PiP).
  RectPt videoFrame() const {
    return {inset_, inset_, std::max(1.0, width_ - 2 * inset_), std::max(1.0, height_ - 2 * inset_)};
  }
  void attach(VideoSurface* surface) {
    surface->setHostWindow((__bridge void*)window_);  // échelle et écran de CETTE fenêtre
    CALayer* layer = (__bridge CALayer*)surface->nativeLayer();
    [videoContainer_ addSublayer:layer];
    surface->setFrame(videoFrame());
    surface->show();
    shown_ = surface;
  }
  void detach(VideoSurface* surface) {
    CALayer* layer = (__bridge CALayer*)surface->nativeLayer();
    if (layer.superlayer == videoContainer_) [layer removeFromSuperlayer];
    if (shown_ == surface) shown_ = nullptr;
  }

  __weak NSWindow* window_ = nil;
  TentacleLayerHostView* host_ = nil;
  NSView* underlay_ = nil;          // verre natif : la vue posée entre vidéo et page
  NSArray* observers_ = nil;
  CALayer* root_ = nil;
  CALayer* videoContainer_ = nil;
  std::unique_ptr<WebLayer> web_;
  VideoSurface* video_ = nullptr;   // la couche vidéo posée par le lecteur (ou la factice)
  VideoSurface* shown_ = nullptr;   // celle qui est DANS cette pile (≠ video_ pendant un prêt)
  Compositor* borrower_ = nullptr;  // PiP : la pile qui montre la vidéo à notre place
  VideoSurface* home_ = nullptr;    // la couche du repos, jamais prêtée
  double inset_ = 0;
  double width_ = 0, height_ = 0;
  CompositorStats stats_;
};

}  // namespace

namespace mac {
std::unique_ptr<Compositor> createCompositor(NSWindow* window, bool transparent) {
  return window ? std::make_unique<CompositorMac>(window, transparent) : nullptr;
}
}  // namespace mac

std::unique_ptr<Compositor> Compositor::create(SDL_Window* window) {
  SDL_PropertiesID props = SDL_GetWindowProperties(window);
  NSWindow* ns = (__bridge NSWindow*)SDL_GetPointerProperty(
      props, SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
  if (!ns) return nullptr;
  return std::make_unique<CompositorMac>(ns);
}

}  // namespace tentacle
