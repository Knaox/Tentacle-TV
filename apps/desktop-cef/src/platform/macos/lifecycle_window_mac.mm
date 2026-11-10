// macOS : la fenêtre d'Electron (`window.ts`, `macosTitleBar.ts`, `appIdentity.ts`).
//
// `titleBarStyle: "hidden"` : la barre de titre retirée, le contenu sous toute la fenêtre (page
// et cadre coïncident : 1280×800 des deux côtés), les feux de circulation posés dans la bande que
// la PAGE dessine (38 points, `titleBarHeight`), leur groupe en (16, 13). Sans ombre
// (`hasShadow: false`, coupée à la fabrication et jamais rallumée). La position des feux est
// celle de `WindowButtonsProxy` d'Electron : AppKit la remet à chaque relayout de la barre
// (redimensionnement, sortie du plein écran), on la repose après chacun.

#import <Cocoa/Cocoa.h>

#include <cstdio>

#include "lifecycle/lifecycle_platform.h"

namespace {

constexpr double kBannerHeight = 38;      // `BANNER_HEIGHT`, source unique côté natif
constexpr NSPoint kTrafficLights{16, 13};  // `TRAFFIC_LIGHTS`

NSWindow* nsWindow(SDL_Window* window) {
  return (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(window),
                                                     SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

// Les feux : groupe calé en (x, y) du coin haut-gauche, la barre ramenée à la hauteur du groupe
// plus deux marges (Electron, `window_buttons_proxy.mm` → `redraw`). Rien n'est écrit si tout
// est déjà en place : nos propres écritures, qui repassent par l'observation, s'arrêtent là.
void placeTrafficLights(NSWindow* w) {
  if (w.styleMask & NSWindowStyleMaskFullScreen) return;  // AppKit les gère en plein écran
  NSButton* close = [w standardWindowButton:NSWindowCloseButton];
  NSButton* mini = [w standardWindowButton:NSWindowMiniaturizeButton];
  NSButton* zoom = [w standardWindowButton:NSWindowZoomButton];
  NSView* container = close.superview.superview;  // NSTitlebarContainerView
  if (!close || !mini || !zoom || !container) return;
  const CGFloat width = NSWidth(close.frame), height = NSHeight(close.frame);
  const CGFloat spacing = NSMinX(mini.frame) - NSMaxX(close.frame);
  NSRect bar = container.frame;
  bar.size.height = height + 2 * kTrafficLights.y;
  bar.origin.y = NSHeight(w.frame) - bar.size.height;
  if (!NSEqualRects(bar, container.frame)) [container setFrame:bar];
  NSArray<NSButton*>* buttons = @[ close, mini, zoom ];
  for (NSUInteger i = 0; i < buttons.count; ++i) {
    const NSPoint at = NSMakePoint(kTrafficLights.x + CGFloat(i) * (width + spacing), kTrafficLights.y);
    if (!NSEqualPoints(at, buttons[i].frame.origin)) [buttons[i] setFrameOrigin:at];
  }
}

}  // namespace

// AppKit refait la barre de titre à SA mise en page (affichage, redimensionnement, changement
// d'état actif…) et remet alors ses feux à (9, 9) sur macOS 26 — mesuré. On suit donc les
// cadres eux-mêmes (NSViewFrameDidChangeNotification des feux et de la barre) et on replace au
// tour suivant de la boucle, une fois la mise en page d'AppKit finie.
@interface TentacleTitleBarKeeper : NSObject
@property(nonatomic, weak) NSWindow* window;
@property(nonatomic) BOOL pending;
@end

@implementation TentacleTitleBarKeeper
- (void)relayout:(NSNotification*)note {
  NSWindow* w = self.window;
  if (!w || self.pending) return;
  self.pending = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    self.pending = NO;
    placeTrafficLights(w);
  });
}
- (void)watch:(NSView*)view {
  if (!view) return;
  view.postsFrameChangedNotifications = YES;
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(relayout:)
                                             name:NSViewFrameDidChangeNotification object:view];
}
@end

namespace tentacle::lifecycle::platform {
namespace {
TentacleTitleBarKeeper* g_keeper = nil;
NSDictionary* g_aboutOptions = nil;
bool g_noActivation = false;
}  // namespace

double titleBarHeight() { return kBannerHeight; }
bool hasWindowFocusBridge() { return true; }

void prepareMainWindow(SDL_Window* window) {
  NSWindow* w = nsWindow(window);
  if (!w) return;
  const NSRect before = w.frame;
  const NSSize content = [w contentRectForFrameRect:before].size;
  w.styleMask |= NSWindowStyleMaskFullSizeContentView;
  w.titlebarAppearsTransparent = YES;
  w.titleVisibility = NSWindowTitleHidden;
  w.hasShadow = NO;
  // Le cadre reprend la taille du contenu demandé (1280×800) : page et cadre coïncident, comme
  // sous Electron — sans quoi la page gagnerait la hauteur de l'ancienne barre de titre.
  NSRect frame = before;
  frame.origin.y += NSHeight(before) - content.height;
  frame.size = content;
  [w setFrame:frame display:NO];
  // La taille minimale vaut pour le CADRE entier (900×600), la barre étant sous la page.
  w.contentMinSize = NSMakeSize(900, 600);

  g_keeper = [TentacleTitleBarKeeper new];
  g_keeper.window = w;
  NSNotificationCenter* nc = NSNotificationCenter.defaultCenter;
  // La mise à l'écran (orderFront) refait la barre sans redimensionner : l'occlusion change, et
  // c'est le premier signal après l'affichage. Le passage au premier plan aussi.
  for (NSNotificationName name in @[ NSWindowDidResizeNotification, NSWindowDidExitFullScreenNotification,
                                     NSWindowDidEndLiveResizeNotification, NSWindowDidBecomeKeyNotification,
                                     NSWindowDidResignKeyNotification, NSWindowDidChangeScreenNotification,
                                     NSWindowDidChangeOcclusionStateNotification ]) {
    [nc addObserver:g_keeper selector:@selector(relayout:) name:name object:w];
  }
  NSButton* close = [w standardWindowButton:NSWindowCloseButton];
  [g_keeper watch:close];
  [g_keeper watch:[w standardWindowButton:NSWindowZoomButton]];
  [g_keeper watch:close.superview];
  [g_keeper watch:close.superview.superview];
  placeTrafficLights(w);
}

void setNoActivation(bool on) { g_noActivation = on; }

std::string windowDebug(SDL_Window* window) {
  NSWindow* w = nsWindow(window);
  if (!w) return "{}";
  NSMutableString* out = [NSMutableString stringWithFormat:@"{\"frame\":\"%@\",\"content\":\"%@\",\"shadow\":%d,\"buttons\":[",
      NSStringFromRect(w.frame), NSStringFromRect([w contentRectForFrameRect:w.frame]), w.hasShadow];
  for (NSWindowButton b : {NSWindowCloseButton, NSWindowMiniaturizeButton, NSWindowZoomButton}) {
    NSButton* btn = [w standardWindowButton:b];
    NSRect inWindow = [btn convertRect:btn.bounds toView:nil];
    [out appendFormat:@"%@\"%@\"", b == NSWindowCloseButton ? @"" : @",", NSStringFromRect(inWindow)];
  }
  NSView* bar = [w standardWindowButton:NSWindowCloseButton].superview.superview;
  [out appendFormat:@"],\"bar\":\"%@\"}", NSStringFromRect(bar.frame)];
  return out.UTF8String;
}

void focusWindow(SDL_Window* window) {
  if (!window) return;
  if (g_noActivation) {
    std::fprintf(stderr, "[cycle] fenêtre ramenée devant (sans activation : --background)\n");
    return;
  }
  if (SDL_GetWindowFlags(window) & SDL_WINDOW_MINIMIZED) SDL_RestoreWindow(window);
  NSWindow* w = nsWindow(window);
  if (!w || !w.visible) return;
  [NSApp activateIgnoringOtherApps:YES];
  [w makeKeyAndOrderFront:nil];
}

void setAboutPanel(const std::string& name, const std::string& version) {
  // `setAboutPanelOptions` : nom et version de l'app, version de build VIDÉE (sinon macOS en
  // affiche deux), l'icône du paquet.
  NSMutableDictionary* options = [NSMutableDictionary dictionary];
  options[NSAboutPanelOptionApplicationName] = [NSString stringWithUTF8String:name.c_str()];
  options[NSAboutPanelOptionApplicationVersion] = [NSString stringWithUTF8String:version.c_str()];
  options[NSAboutPanelOptionVersion] = @"";
  if (NSImage* icon = NSApp.applicationIconImage) options[NSAboutPanelOptionApplicationIcon] = icon;
  g_aboutOptions = options;
}

}  // namespace tentacle::lifecycle::platform

namespace tentacle::platform {
// Lu par `-[TentacleApplication orderFrontStandardAboutPanel:]` (app_mac.mm).
NSDictionary* aboutPanelOptions() { return tentacle::lifecycle::platform::g_aboutOptions; }
}  // namespace tentacle::platform
