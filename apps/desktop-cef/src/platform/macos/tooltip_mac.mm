// Bulle d'aide macOS : l'apparence de la bulle du système (matériau `ToolTip` d'AppKit, police
// `toolTipsFont`, ombre, coins arrondis), dans un panneau sans focus que la souris traverse,
// posé sous le curseur. API publiques seulement : la bulle système n'est accessible qu'en
// détournant des méthodes PRIVÉES de NSView (ce que fait Chromium) — refusé ici (Mac App Store).
// Comme la bulle système, rien n'apparaît tant que l'application n'est pas au premier plan
// (sauf banc : TENTACLE_DEBUG_NAVIGATEUR=1).

#import <AppKit/AppKit.h>

#include <cstdlib>

#include "shell/tooltip.h"

@interface TentacleTooltipPanel : NSPanel
@end

@implementation TentacleTooltipPanel
- (BOOL)canBecomeKeyWindow {
  return NO;
}
- (BOOL)canBecomeMainWindow {
  return NO;
}
@end

namespace tentacle::platform {
namespace {

constexpr CGFloat kPadX = 6, kPadY = 3, kMaxWidth = 300, kBelowCursor = 20;

NSWindow* nsWindow(SDL_Window* w) {
  return (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(w),
                                                    SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

class MacTooltip final : public TooltipWindow {
 public:
  explicit MacTooltip(NSWindow* parent) : parent_(parent) {
    panel_ = [[TentacleTooltipPanel alloc]
        initWithContentRect:NSZeroRect
                  styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
                    backing:NSBackingStoreBuffered
                      defer:YES];
    panel_.level = NSPopUpMenuWindowLevel;
    panel_.opaque = NO;
    panel_.backgroundColor = NSColor.clearColor;
    panel_.hasShadow = YES;
    panel_.ignoresMouseEvents = YES;
    panel_.hidesOnDeactivate = YES;
    panel_.releasedWhenClosed = NO;
    NSVisualEffectView* fx = [[NSVisualEffectView alloc] initWithFrame:NSZeroRect];
    fx.material = NSVisualEffectMaterialToolTip;
    fx.blendingMode = NSVisualEffectBlendingModeBehindWindow;
    fx.state = NSVisualEffectStateActive;
    fx.wantsLayer = YES;
    fx.layer.cornerRadius = 6;
    fx.layer.masksToBounds = YES;
    label_ = [NSTextField wrappingLabelWithString:@""];
    label_.font = [NSFont toolTipsFontOfSize:0];
    label_.textColor = NSColor.labelColor;
    label_.preferredMaxLayoutWidth = kMaxWidth;
    [fx addSubview:label_];
    panel_.contentView = fx;
  }
  ~MacTooltip() override { [panel_ orderOut:nil]; }

  void show(const std::string& text, float x, float y) override {
    static const bool bench = std::getenv("TENTACLE_DEBUG_NAVIGATEUR") != nullptr;
    if (!parent_ || (!NSApp.isActive && !bench)) return;
    label_.stringValue = [NSString stringWithUTF8String:text.c_str()] ?: @"";
    const NSSize fit = label_.fittingSize;
    const NSSize size = NSMakeSize(std::ceil(fit.width) + 2 * kPadX, std::ceil(fit.height) + 2 * kPadY);
    label_.frame = NSMakeRect(kPadX, kPadY, size.width - 2 * kPadX, size.height - 2 * kPadY);
    // Curseur (points de la vue, origine en haut) → écran ; la bulle dessous, dans l'écran.
    NSView* content = parent_.contentView;
    const NSPoint inWindow = [content convertPoint:NSMakePoint(x, content.isFlipped ? y
                                                                   : content.bounds.size.height - y)
                                            toView:nil];
    const NSPoint cursor = [parent_ convertPointToScreen:inWindow];
    NSRect frame = NSMakeRect(cursor.x, cursor.y - kBelowCursor - size.height, size.width, size.height);
    const NSRect screen = (parent_.screen ?: NSScreen.mainScreen).visibleFrame;
    if (NSMaxX(frame) > NSMaxX(screen)) frame.origin.x = NSMaxX(screen) - frame.size.width;
    if (frame.origin.x < NSMinX(screen)) frame.origin.x = NSMinX(screen);
    if (frame.origin.y < NSMinY(screen)) frame.origin.y = cursor.y + 4;  // pas de place dessous
    [panel_ setFrame:frame display:YES];
    [panel_ orderFront:nil];
  }

  void hide() override { [panel_ orderOut:nil]; }
  bool visible() const override { return panel_.visible; }

 private:
  __weak NSWindow* parent_;
  TentacleTooltipPanel* panel_;
  NSTextField* label_;
};

}  // namespace

std::unique_ptr<TooltipWindow> createTooltipWindow(SDL_Window* parent) {
  NSWindow* w = nsWindow(parent);
  if (!w) return nullptr;
  return std::make_unique<MacTooltip>(w);
}

int tooltipDelayMs() {
  // NSInitialToolTipDelay (réglage de l'utilisateur), sinon le défaut d'AppKit.
  const NSInteger ms = [NSUserDefaults.standardUserDefaults integerForKey:@"NSInitialToolTipDelay"];
  return ms > 0 ? int(ms) : 1000;
}

}  // namespace tentacle::platform
