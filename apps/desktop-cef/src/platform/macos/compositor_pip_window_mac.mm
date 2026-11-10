// macOS : la fenêtre PiP native — fabrication (`pipWindow.ts`), modes et ancrage
// (`pipDocking.ts`), garde du redimensionnement (`pipResizeGuard.ts`), retour du focus.

#import "platform/macos/compositor_mac.h"
#import "platform/macos/compositor_pip_mac.h"

#include <functional>

using tentacle::pip::Box;
using tentacle::pip::Mode;

/// Sans cadre, une NSWindow refuse le focus clavier : celle-ci le prend le temps d'un clic
/// (puis le rend à la fenêtre principale), comme la fenêtre d'Electron.
@interface TentaclePipWindow : NSWindow
@end
@implementation TentaclePipWindow
- (BOOL)canBecomeKeyWindow {
  return YES;
}
- (BOOL)canBecomeMainWindow {
  return NO;
}
@end

@interface TentaclePipDelegate : NSObject <NSWindowDelegate>
@property(nonatomic) std::function<NSSize(NSSize)> willResize;
@property(nonatomic) std::function<void()> resized, endedLiveResize, rescaled, becameKey;
@end
@implementation TentaclePipDelegate
- (NSSize)windowWillResize:(NSWindow*)sender toSize:(NSSize)size {
  return _willResize ? _willResize(size) : size;
}
- (void)windowDidResize:(NSNotification*)n {
  if (_resized) _resized();
}
- (void)windowDidEndLiveResize:(NSNotification*)n {
  if (_endedLiveResize) _endedLiveResize();
}
- (void)windowDidChangeBackingProperties:(NSNotification*)n {
  if (_rescaled) _rescaled();
}
- (void)windowDidBecomeKey:(NSNotification*)n {
  if (_becameKey) _becameKey();
}
@end

namespace tentacle::pip::mac {
namespace {

double primaryHeight() { return NSScreen.screens.firstObject.frame.size.height; }

class MacPipWindow final : public Window {
 public:
  MacPipWindow(NSWindow* host, const Box& box, Mode mode, const std::string& caption,
               PageInput input)
      : host_(host), input_(input) {
    constexpr NSWindowStyleMask style = NSWindowStyleMaskBorderless | NSWindowStyleMaskResizable;
    window_ = [[TentaclePipWindow alloc] initWithContentRect:toAppKit(box)
                                                   styleMask:style
                                                     backing:NSBackingStoreBuffered
                                                       defer:NO];
    window_.releasedWhenClosed = NO;
    window_.opaque = NO;
    window_.backgroundColor = NSColor.clearColor;
    // L'ombre d'une fenêtre transparente coûte le GPU (CLAUDE.md, « Coût GPU ») : la page
    // dessine la sienne dans la marge du cadre.
    window_.hasShadow = NO;
    // Ni zoom à l'apparition ni rétrécissement à la fermeture : c'est le PiP qui s'anime.
    window_.animationBehavior = NSWindowAnimationBehaviorNone;
    window_.excludedFromWindowsMenu = YES;
    window_.acceptsMouseMovedEvents = YES;
    window_.title = [NSString stringWithUTF8String:caption.c_str()];
    window_.appearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
    view_ = [[TentaclePipView alloc] initWithFrame:NSMakeRect(0, 0, box.width, box.height)
                                             input:input];
    window_.contentView = view_;
    [window_ makeFirstResponder:view_];
    stack_ = tentacle::mac::createCompositor(window_, /*transparent=*/true);
    delegate_ = [TentaclePipDelegate new];
    delegate_.willResize = [this](NSSize size) { return guardSize(size); };
    delegate_.resized = [this] { onResized(false); };
    delegate_.rescaled = [this] { onResized(true); };
    delegate_.endedLiveResize = [this] {
      if (events_.resizedByUser) events_.resizedByUser();
    };
    delegate_.becameKey = [this] { returnFocus(); };
    window_.delegate = delegate_;
    observeHost();
    applyMode(mode);
    syncStack();
  }

  ~MacPipWindow() override {
    stopDocking();
    for (id o in hostObservers_) [NSNotificationCenter.defaultCenter removeObserver:o];
    [view_ detach];
    window_.delegate = nil;
    stack_.reset();  // la page et la vidéo quittent la fenêtre AVANT elle
    [window_ orderOut:nil];
    [window_ close];
  }

  Box bounds() override { return fromAppKit(window_.frame); }

  void setBounds(const Box& box) override {
    [window_ setFrame:toAppKit(box) display:NO animate:NO];
  }

  void showInactive() override { [window_ orderFrontRegardless]; }
  void hide() override { [window_ orderOut:nil]; }

  void applyMode(Mode mode) override {
    mode_ = mode;
    stopDocking();
    NSWindowCollectionBehavior b = window_.collectionBehavior;
    if (mode == Mode::floating) {
      // Au-dessus des fenêtres ordinaires, sur tous les bureaux, plein écran compris.
      window_.level = NSFloatingWindowLevel;
      b |= NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary;
      window_.collectionBehavior = b;
      return;
    }
    b &= ~(NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary);
    window_.collectionBehavior = b;
    startDocking();
  }

  void setCaption(const std::string& caption) override {
    window_.title = [NSString stringWithUTF8String:caption.c_str()];
  }
  void setEvents(WindowEvents events) override { events_ = std::move(events); }
  bool focused() override { return window_.keyWindow; }
  Compositor* compositor() override { return stack_.get(); }
  double backingScale() override { return window_.backingScaleFactor; }
  Box screenBounds() override { return fromAppKit(screen().frame); }
  Box screenWorkArea() override { return fromAppKit(screen().visibleFrame); }

  std::string describe() override { return describeWindow(window_); }
  std::string inject(const std::string& kind, double x, double y, int clicks, double dy) override {
    return injectInto(window_, kind, x, y, clicks, dy);
  }

  TentaclePipView* view() const { return view_; }

 private:
  NSScreen* screen() const { return window_.screen ?: NSScreen.mainScreen; }

  // Le système propose une taille (bord tiré) : la garde du PiP la borne et la remet au ratio ;
  // AppKit garde lui-même fixe le bord que la main ne tire pas.
  NSSize guardSize(NSSize size) {
    if (!events_.willResize) return size;
    const Box current = bounds();
    Box proposed = current;
    proposed.width = size.width;
    proposed.height = size.height;
    const Box target = events_.willResize(current, proposed);
    if (mode_ == Mode::docked) {
      // Ancré : le coin reste celui de l'application, quel que soit le coin tiré.
      std::weak_ptr<int> alive = alive_;
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!alive.expired() && events_.hostMoved) events_.hostMoved();
      });
    }
    return NSMakeSize(target.width, target.height);
  }

  void onResized(bool scaleChanged) {
    syncStack();
    if (input_.resized) input_.resized(scaleChanged);
  }

  void syncStack() {
    const NSSize size = view_.bounds.size;
    if (stack_) stack_->resize(size.width, size.height, window_.backingScaleFactor);
  }

  // macOS : un clic dans le PiP lui donne le focus — et le premier clic suivant dans la
  // fenêtre principale ne servait plus qu'à la réactiver. Il revient donc aussitôt à la
  // fenêtre principale ; jamais si elle est réduite, cachée ou sur un autre bureau.
  void returnFocus() {
    NSWindow* host = host_;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (!host || host.miniaturized || !host.visible || host.keyWindow || !host.onActiveSpace) return;
      [host makeKeyAndOrderFront:nil];
    });
  }

  void observeHost() {
    if (!host_) return;
    NSNotificationCenter* nc = NSNotificationCenter.defaultCenter;
    auto moved = ^(NSNotification*) {
      if (events_.hostMoved) events_.hostMoved();
    };
    hostObservers_ = @[
      [nc addObserverForName:NSWindowDidMoveNotification object:host_ queue:nil usingBlock:moved],
      [nc addObserverForName:NSWindowDidResizeNotification object:host_ queue:nil usingBlock:moved],
    ];
  }

  // --- Ancré (`pipDocking.ts`) : devant l'application SANS en être une fenêtre fille ----------
  // Application active : niveau « floating » ; inactive : niveau normal, juste au-dessus de la
  // fenêtre principale ; principale réduite : le PiP aussi, et il revient avec elle.
  void startDocking() {
    if (!host_) return;
    NSNotificationCenter* nc = NSNotificationCenter.defaultCenter;
    std::weak_ptr<int> alive = alive_;
    auto sync = ^(NSNotification*) {
      // Le focus passe d'une fenêtre à l'autre en deux temps : lu une fois le passage fini.
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!alive.expired()) applyDocking(false);
      });
    };
    NSMutableArray* o = [NSMutableArray array];
    for (NSWindow* w in @[ host_, window_ ]) {
      [o addObject:[nc addObserverForName:NSWindowDidBecomeKeyNotification object:w queue:nil usingBlock:sync]];
      [o addObject:[nc addObserverForName:NSWindowDidResignKeyNotification object:w queue:nil usingBlock:sync]];
    }
    [o addObject:[nc addObserverForName:NSApplicationDidBecomeActiveNotification object:nil queue:nil usingBlock:sync]];
    [o addObject:[nc addObserverForName:NSApplicationDidResignActiveNotification object:nil queue:nil usingBlock:sync]];
    [o addObject:[nc addObserverForName:NSWindowDidMiniaturizeNotification object:host_ queue:nil
                             usingBlock:^(NSNotification*) { [window_ orderOut:nil]; }]];
    [o addObject:[nc addObserverForName:NSWindowDidDeminiaturizeNotification object:host_ queue:nil
                             usingBlock:^(NSNotification*) {
                               if (host_.miniaturized) return;
                               [window_ orderFrontRegardless];
                               applyDocking(true);
                             }]];
    dockObservers_ = o;
    applyDocking(true);
  }

  void stopDocking() {
    for (id o in dockObservers_) [NSNotificationCenter.defaultCenter removeObserver:o];
    dockObservers_ = nil;
  }

  void applyDocking(bool force) {
    if (mode_ != Mode::docked || !host_) return;
    const bool active = NSApp.active && (host_.keyWindow || window_.keyWindow);
    if (!force && active == dockedActive_) return;
    dockedActive_ = active;
    if (active) {
      window_.level = NSFloatingWindowLevel;
    } else {
      window_.level = NSNormalWindowLevel;
      if (window_.visible) [window_ orderWindow:NSWindowAbove relativeTo:host_.windowNumber];
    }
  }

  __weak NSWindow* host_ = nil;
  TentaclePipWindow* window_ = nil;
  TentaclePipView* view_ = nil;
  TentaclePipDelegate* delegate_ = nil;
  std::unique_ptr<Compositor> stack_;
  PageInput input_;
  WindowEvents events_;
  Mode mode_ = Mode::floating;
  bool dockedActive_ = false;
  NSArray* hostObservers_ = nil;
  NSArray* dockObservers_ = nil;
  // Un rappel différé (dispatch_async) ne touche jamais une fenêtre détruite.
  std::shared_ptr<int> alive_ = std::make_shared<int>(0);
};

}  // namespace

NSRect toAppKit(const Box& box) {
  return NSMakeRect(box.x, primaryHeight() - box.y - box.height, box.width, box.height);
}

Box fromAppKit(NSRect r) {
  return {r.origin.x, primaryHeight() - r.origin.y - r.size.height, r.size.width, r.size.height};
}

std::unique_ptr<Window> createWindow(NSWindow* host, const Box& box, Mode mode,
                                     const std::string& caption, PageInput input) {
  return std::make_unique<MacPipWindow>(host, box, mode, caption, std::move(input));
}

void setWindowCursor(Window& window, int type) {
  [static_cast<MacPipWindow&>(window).view() setCefCursor:type];
}

}  // namespace tentacle::pip::mac
