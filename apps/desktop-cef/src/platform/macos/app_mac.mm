// NSApplication conforme à CefAppProtocol, créée AVANT SDL_Init : SDL3 réutilise NSApp
// s'il existe déjà (Cocoa_RegisterApp), et CEF exige ce protocole pour suivre les
// évènements en cours d'envoi (menus, glisser-déposer).

#import <Cocoa/Cocoa.h>

#include "app/platform_app.h"
#include "include/cef_application_mac.h"
#include "platform/macos/shell_menu_mac.h"

@interface TentacleApplication : NSApplication <CefAppProtocol> {
  BOOL handlingSendEvent_;
}
@end

@implementation TentacleApplication
- (BOOL)isHandlingSendEvent {
  return handlingSendEvent_;
}
- (void)setHandlingSendEvent:(BOOL)handling {
  handlingSendEvent_ = handling;
}
- (void)sendEvent:(NSEvent*)event {
  CefScopedSendingEvent scoped;
  // ⌘/⌃+touche : SDL3 l'a déjà lue dans sa pompe ; la page la voit d'abord, les menus
  // seulement si elle ne la consomme pas (shell/app_menu.h), comme dans Electron.
  if (tentacle::platform::holdKeyEquivalent(event)) return;
  [super sendEvent:event];
}
// Jamais exit() depuis AppKit : on demande à la boucle SDL de fermer proprement
// (fermeture du navigateur, CefShutdown).
- (void)terminate:(id)sender {
  SDL_Event e{};
  e.type = SDL_EVENT_QUIT;
  SDL_PushEvent(&e);
}
@end

namespace tentacle::platform {

void initApplication() {
  [TentacleApplication sharedApplication];
  [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
}

void* nativeWindow(SDL_Window* window) {
  return SDL_GetPointerProperty(SDL_GetWindowProperties(window),
                                SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

void prepareWindow(SDL_Window* window, bool activate) {
  NSWindow* ns = (__bridge NSWindow*)nativeWindow(window);
  if (!ns) return;
  ns.appearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
  ns.backgroundColor = [NSColor blackColor];
  // Plein écran natif (espace dédié, bouton vert) : SDL3 le gère avec
  // SDL_SetWindowFullscreen quand SDL_HINT_VIDEO_MAC_FULLSCREEN_SPACES vaut 1 (défaut).
  ns.collectionBehavior |= NSWindowCollectionBehaviorFullScreenPrimary;
  if (activate) {
    [NSApp activateIgnoringOtherApps:YES];
    [ns makeKeyAndOrderFront:nil];
  } else {
    [ns orderFront:nil];
  }
}

std::string acceptLanguages() {
  // NSLocale.preferredLanguages : « fr-CH », « en-AU »… Chaque langue est suivie de sa base
  // (« fr ») si elle manque, comme la liste qu'Electron/Chromium dérive du système.
  NSMutableArray<NSString*>* out = [NSMutableArray array];
  for (NSString* lang in NSLocale.preferredLanguages) {
    NSString* tag = [lang stringByReplacingOccurrencesOfString:@"_" withString:@"-"];
    if (![out containsObject:tag]) [out addObject:tag];
    NSString* base = [tag componentsSeparatedByString:@"-"].firstObject;
    if (base.length && ![out containsObject:base]) [out addObject:base];
  }
  return [out componentsJoinedByString:@","].UTF8String;
}

std::string resourceUrl(const char* name) {
  NSString* file = [NSString stringWithUTF8String:name];
  NSString* path = [[NSBundle mainBundle] pathForResource:file.stringByDeletingPathExtension
                                                   ofType:file.pathExtension];
  if (!path) return "about:blank";
  return [NSURL fileURLWithPath:path].absoluteString.UTF8String;
}

}  // namespace tentacle::platform
