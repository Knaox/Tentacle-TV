// Le verre natif de macOS 26 — `nativeGlass.ts` d'Electron, en Objective-C++ direct : trois
// classes PUBLIQUES d'AppKit (`NSGlassEffectView`, `NSGlassEffectContainerView`,
// `NSAnimationContext`), jamais une API privée (le build du Mac App Store reçoit exactement ce
// code ; `tests/private_api.cmake` le tient).
//
// Où vit le verre (Tentacle CEF) :
//   vue de contenu de SDL → hôte de couches du compositeur → [vidéo z 0, RACINE z 5, page z 10]
//   racine → NSGlassEffectContainerView (un par groupe) → contentView → NSGlassEffectView…
// La racine passe par `Compositor::setUnderlay` : ENTRE la vidéo et la page, comme sous Electron
// (sous la vue web, au-dessus de la fenêtre de mpv). Le verre ne se voit que là où la page est
// transparente — pendant une lecture — et réfracte la couche vidéo (mesuré sur maquette).
//
// Propriété (`backend.h`) : une poignée est une NSView RETENUE (+1, CFBridgingRetain) ; `dispose`
// la retire puis la rend, `release` la rend seulement. La vue de contenu d'un groupe appartient
// à son conteneur et n'est jamais rendue à part.

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/runtime.h>

#include <atomic>

#include <map>
#include <memory>
#include <string>

#include "app/app.h"
#include "compositor/compositor.h"
#include "glass/glass_platform.h"

// Bancs : chaque vue du verre porte un témoin (objet associé, API publique du runtime) qui
// décompte à sa libération — « aucune fuite » se prouve par ce compteur revenu à 0.
static std::atomic<int> g_liveViews{0};
@interface TentacleGlassWitness : NSObject
@end
@implementation TentacleGlassWitness
- (instancetype)init {
  if ((self = [super init])) g_liveViews++;
  return self;
}
- (void)dealloc {
  g_liveViews--;
}
@end

namespace tentacle::glass {
namespace {

char kWitnessKey;
template <typename V>
V* witnessed(V* v) {
  objc_setAssociatedObject(v, &kWitnessKey, [TentacleGlassWitness new], OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  return v;
}

/// `NSViewMinYMargin` : la marge du BAS est souple, celle du haut tenue — le verre garde sa
/// distance au haut de la fenêtre quand elle change de taille : le repère de la page.
constexpr NSAutoresizingMaskOptions kKeepTop = NSViewMinYMargin;
constexpr NSAutoresizingMaskOptions kFill = NSViewWidthSizable | NSViewHeightSizable;
/// La courbe des fondus : l'accélération-décélération d'AppKit.
constexpr Ease kFade{0.42, 0, 0.58, 1};

NSView* view(ViewHandle h) { return (__bridge NSView*)h; }
ViewHandle retained(NSView* v) { return v == nil ? nullptr : (ViewHandle)CFBridgingRetain(v); }
NSRect nsRect(const Rect& r) { return NSMakeRect(r.x, r.y, r.width, r.height); }
Rect rectOf(NSRect r) { return {r.origin.x, r.origin.y, r.size.width, r.size.height}; }

/// Joue `gesture` sur le mandataire `animator` de la vue : `durationMs`, courbe `points`. Par
/// l'animateur d'AppKit et par lui seulement : la forme d'un verre IGNORE une animation Core
/// Animation posée sur sa couche (mesuré par Electron, `springCurve.ts`).
void animate(NSView* v, double durationMs, const Ease& points, void (^gesture)(id animator)) {
  [NSAnimationContext runAnimationGroup:^(NSAnimationContext* context) {
    context.duration = durationMs / 1000.0;
    context.timingFunction = [CAMediaTimingFunction functionWithControlPoints:(float)points[0]:(float)points[1]
                                                                             :(float)points[2]:(float)points[3]];
    gesture(v.animator);
  }];
}

NSAppearance* appearanceOf(std::optional<Appearance> a) {
  if (!a) return nil;
  return [NSAppearance appearanceNamed:*a == Appearance::Dark ? NSAppearanceNameDarkAqua : NSAppearanceNameAqua];
}

class API_AVAILABLE(macos(26.0)) AppKitGlassBackend final : public GlassBackend {
 public:
  AppKitGlassBackend(NSWindow* window, Compositor* compositor) : window_(window), compositor_(compositor) {}

  ViewHandle createRoot() override {
    NSView* content = window_.contentView;
    if (content == nil) return nullptr;
    NSView* root = witnessed([[NSView alloc] initWithFrame:content.bounds]);
    root.wantsLayer = YES;
    root.autoresizingMask = kFill;
    if (!compositor_->setUnderlay((__bridge void*)root)) return nullptr;
    root_ = retained(root);
    return root_;
  }

  double contentHeight() override { return window_.contentView ? window_.contentView.bounds.size.height : 0; }

  void setHidden(ViewHandle h, bool hidden) override { view(h).hidden = hidden; }

  GroupHandle createGroup(ViewHandle root, double spacing, double alpha) override {
    const NSRect bounds = view(root).bounds;
    NSGlassEffectContainerView* container = witnessed([[NSGlassEffectContainerView alloc] initWithFrame:bounds]);
    NSView* content = witnessed([[NSView alloc] initWithFrame:bounds]);
    container.autoresizingMask = kFill;
    content.autoresizingMask = kFill;
    container.spacing = spacing;
    if (alpha != 1) container.alphaValue = alpha;
    // Le conteneur retient sa vue de contenu : elle part avec lui, jamais rendue à part.
    container.contentView = content;
    [view(root) addSubview:container positioned:NSWindowAbove relativeTo:nil];
    return {retained(container), (__bridge ViewHandle)content};
  }

  void setSpacing(const GroupHandle& group, double spacing) override {
    ((NSGlassEffectContainerView*)view(group.container)).spacing = spacing;
  }

  ViewHandle createGlass(const GlassProps& props) override {
    NSGlassEffectView* glass = witnessed([[NSGlassEffectView alloc] initWithFrame:nsRect(props.frame)]);
    glass.autoresizingMask = kKeepTop;
    glass.cornerRadius = props.radius;
    glass.style = props.style == 1 ? NSGlassEffectViewStyleClear : NSGlassEffectViewStyleRegular;
    ViewHandle h = retained(glass);
    if (props.tint) setTint(h, props.tint);
    if (props.appearance) setAppearance(h, props.appearance);
    return h;
  }

  void setFrame(ViewHandle h, const Rect& frame, const std::optional<NativeMotion>& motion) override {
    NSView* v = view(h);
    if (!motion || motion->durationMs <= 0) {
      v.frame = nsRect(frame);
      return;
    }
    const NSRect target = nsRect(frame);
    animate(v, motion->durationMs, motion->points, ^(id animator) { [animator setFrame:target]; });
  }

  void setRadius(ViewHandle h, double radius) override { ((NSGlassEffectView*)view(h)).cornerRadius = radius; }

  void setStyle(ViewHandle h, int style) override {
    ((NSGlassEffectView*)view(h)).style = style == 1 ? NSGlassEffectViewStyleClear : NSGlassEffectViewStyleRegular;
  }

  void setTint(ViewHandle h, const std::optional<Rgba>& tint) override {
    ((NSGlassEffectView*)view(h)).tintColor =
        tint ? [NSColor colorWithSRGBRed:tint->r green:tint->g blue:tint->b alpha:tint->a] : nil;
  }

  void setAppearance(ViewHandle h, std::optional<Appearance> appearance) override {
    view(h).appearance = appearanceOf(appearance);
  }

  void setAlpha(ViewHandle h, double alpha, double durationMs, const std::optional<Ease>& ease) override {
    NSView* v = view(h);
    if (durationMs <= 0) {
      v.alphaValue = alpha;
      return;
    }
    animate(v, durationMs, ease.value_or(kFade), ^(id animator) { [animator setAlphaValue:alpha]; });
  }

  void placeBelow(ViewHandle parent, ViewHandle h, ViewHandle anchor) override {
    if (anchor == nullptr) [view(parent) addSubview:view(h) positioned:NSWindowAbove relativeTo:nil];
    else [view(parent) addSubview:view(h) positioned:NSWindowBelow relativeTo:view(anchor)];
  }

  void dispose(ViewHandle h) override {
    NSView* v = (__bridge_transfer NSView*)h;  // notre +1 revient à ARC : rendue en fin de portée
    if (h == root_) {
      root_ = nullptr;
      compositor_->setUnderlay(nullptr);  // la pile la rend aussi
    }
    [v removeFromSuperview];
  }

  void release(ViewHandle h) override {
    if (h == root_) root_ = nullptr;
    CFBridgingRelease(h);
  }

  GlassInspection inspect(ViewHandle h) override {
    NSView* v = view(h);
    GlassInspection out;
    out.frame = rectOf(v.frame);
    out.alpha = v.alphaValue;
    out.hidden = v.isHiddenOrHasHiddenAncestor;
    if ([v isKindOfClass:NSGlassEffectView.class]) {
      out.radius = ((NSGlassEffectView*)v).cornerRadius;
      out.style = (int)((NSGlassEffectView*)v).style;
    }
    // La couche de PRÉSENTATION du verre et de son conteneur (verre → contenu → conteneur) :
    // ce qu'AppKit affiche à l'instant, animation comprise.
    CALayer* shown = v.layer.presentationLayer;
    CALayer* containerShown = v.superview.superview.layer.presentationLayer;
    if (shown && containerShown) out.live = GlassInspection::Live{rectOf(NSRectFromCGRect(shown.frame)), containerShown.opacity};
    return out;
  }

  int countGlass(ViewHandle root) override { return count(view(root), 0); }

 private:
  static int count(NSView* v, int depth) {
    if ([v isKindOfClass:NSGlassEffectView.class]) return 1;
    if (depth > 4) return 0;
    int total = 0;
    for (NSView* child in v.subviews) total += count(child, depth + 1);
    return total;
  }

  __weak NSWindow* window_ = nil;
  Compositor* compositor_;
  ViewHandle root_ = nullptr;  // la racine posée par `createRoot` (entre vidéo et page)
};

}  // namespace

namespace platform {

int liveNativeViews() { return g_liveViews.load(); }

std::unique_ptr<GlassBackend> createBackend(AppContext& ctx) {
  NSWindow* window = (__bridge NSWindow*)ctx.nativeWindow;
  if (window == nil || ctx.compositor == nullptr) return nullptr;
  if (@available(macOS 26.0, *)) return std::make_unique<AppKitGlassBackend>(window, ctx.compositor);
  return nullptr;
}

}  // namespace platform
}  // namespace tentacle::glass
