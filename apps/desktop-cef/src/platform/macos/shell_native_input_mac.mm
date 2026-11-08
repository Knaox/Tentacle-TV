// macOS : défilement natif (moniteur local) et injection d'évènements pour le banc.

#import <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>

#include <cstdio>
#include <cstdlib>

#include "shell/native_input.h"

namespace tentacle::platform {
namespace {

id g_monitor = nil;
id g_trace = nil;

NSWindow* nsWindow(SDL_Window* w) {
  return (__bridge NSWindow*)SDL_GetPointerProperty(SDL_GetWindowProperties(w),
                                                    SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
}

// Chromium (WebMouseWheelEventBuilder) : un cran de molette = 40 px.
constexpr float kPixelsPerTick = 40.0f;

NSEventModifierFlags modsFrom(const Json& ev) {
  NSEventModifierFlags m = 0;
  for (const auto& s : ev.value("mods", Json::array())) {
    const std::string k = s.get<std::string>();
    // + bit « côté gauche » (NX_DEVICEL*KEYMASK), comme le vrai clavier : sans lui, SDL3
    // compte gauche ET droite.
    if (k == "cmd") m |= NSEventModifierFlagCommand | 0x08;
    if (k == "shift") m |= NSEventModifierFlagShift | 0x02;
    if (k == "alt") m |= NSEventModifierFlagOption | 0x20;
    if (k == "ctrl") m |= NSEventModifierFlagControl | 0x01;
  }
  return m;
}

// Ce que taperait la touche `keyCode` avec la disposition ACTIVE (Suisse romande, AZERTY…),
// comme le ferait le vrai clavier : le banc envoie alors des NSEvent fidèles au poste.
NSString* layoutChars(unsigned short keyCode, NSEventModifierFlags mods) {
  TISInputSourceRef src = TISCopyCurrentKeyboardLayoutInputSource();
  if (!src) return @"";
  CFDataRef data = (CFDataRef)TISGetInputSourceProperty(src, kTISPropertyUnicodeKeyLayoutData);
  NSString* out = @"";
  if (data) {
    UInt32 carbon = 0;
    if (mods & NSEventModifierFlagShift) carbon |= shiftKey;
    if (mods & NSEventModifierFlagOption) carbon |= optionKey;
    if (mods & NSEventModifierFlagControl) carbon |= controlKey;
    if (mods & NSEventModifierFlagCommand) carbon |= cmdKey;
    UInt32 dead = 0;
    UniChar buf[8];
    UniCharCount len = 0;
    UCKeyTranslate((const UCKeyboardLayout*)CFDataGetBytePtr(data), keyCode, kUCKeyActionDown,
                   (carbon >> 8) & 0xFF, LMGetKbdType(), kUCKeyTranslateNoDeadKeysMask, &dead, 8,
                   &len, buf);
    out = [NSString stringWithCharacters:buf length:len];
  }
  CFRelease(src);
  return out;
}

}  // namespace

bool installNativeWheel(SDL_Window* window, std::function<void(const NativeWheel&)> sink) {
  NSWindow* win = nsWindow(window);
  if (!win || g_monitor) return win != nil;
  g_monitor = [NSEvent
      addLocalMonitorForEventsMatchingMask:NSEventMaskScrollWheel
                                   handler:^NSEvent*(NSEvent* e) {
                                     // Un évènement venu d'un CGEvent (banc) n'a pas de fenêtre :
                                     // sa position est alors en coordonnées d'écran.
                                     if (e.window && e.window != win) return e;
                                     NSView* v = win.contentView;
                                     const NSPoint inWin = e.window ? e.locationInWindow
                                                                    : [win convertPointFromScreen:e.locationInWindow];
                                     NSPoint p = [v convertPoint:inWin fromView:nil];
                                     if (!e.window && !NSPointInRect(p, v.bounds)) return e;
                                     NativeWheel w;
                                     w.x = p.x;
                                     w.y = v.isFlipped ? p.y : v.bounds.size.height - p.y;
                                     w.precise = e.hasPreciseScrollingDeltas;
                                     const float k = w.precise ? 1.0f : kPixelsPerTick;
                                     w.dx = e.scrollingDeltaX * k;
                                     w.dy = e.scrollingDeltaY * k;
                                     sink(w);
                                     return e;  // SDL le voit aussi ; le socle ignore sa version
                                   }];
  if (getenv("TENTACLE_INPUT_LOG") && !g_trace) {
    // Diagnostic : ce que reçoit AppKit, avant SDL (type, fenêtre, position dans la fenêtre).
    g_trace = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved |
                                                            NSEventMaskLeftMouseDown |
                                                            NSEventMaskRightMouseDown |
                                                            NSEventMaskFlagsChanged
                                                    handler:^NSEvent*(NSEvent* e) {
                                                      std::fprintf(stderr, "[appkit] type=%d win=%d %.1f,%.1f mods=%lx\n",
                                                                   int(e.type), e.window == win,
                                                                   e.locationInWindow.x, e.locationInWindow.y,
                                                                   (unsigned long)e.modifierFlags);
                                                      return e;
                                                    }];
  }
  return true;
}

void uninstallNativeWheel() {
  if (g_monitor) [NSEvent removeMonitor:g_monitor];
  if (g_trace) [NSEvent removeMonitor:g_trace];
  g_monitor = g_trace = nil;
}

std::string injectNative(SDL_Window* window, const Json& ev) {
  NSWindow* win = nsWindow(window);
  if (!win) return "pas de fenêtre";
  const std::string type = ev.value("type", "");
  NSView* v = win.contentView;
  // Points de la vue (origine en haut à gauche) → écran, MAINTENANT : un geste différé
  // (redimensionnement) garde sa position à l'écran même si la fenêtre bouge entre-temps.
  const double x = ev.value("x", 0.0), y = ev.value("y", 0.0);
  NSPoint inWin = [v convertPoint:NSMakePoint(x, v.isFlipped ? y : v.bounds.size.height - y)
                           toView:nil];
  const NSPoint screenPt = [win convertPointToScreen:inWin];
  NSPoint loc = inWin;
  const NSTimeInterval ts = NSProcessInfo.processInfo.systemUptime;
  NSEvent* e = nil;
  const int delayMs = ev.value("delayMs", 0);
  if (type == "mouse" && ev.value("via", "sdl") == "sdl") {
    // macOS 26 : SDL3 (mouseMoved:) remplace la position de l'évènement par celle du VRAI
    // curseur (SDL_GetGlobalMouseState, contournement d'un bogue d'Apple) : un NSEvent posté
    // ne déplace donc pas la souris pour SDL. On injecte au niveau SDL → socle → CEF.
    const std::string kind = ev.value("kind", "move");
    SDL_Event se{};
    if (kind == "move") {
      se.type = SDL_EVENT_MOUSE_MOTION;
      se.motion.windowID = SDL_GetWindowID(window);
      se.motion.x = float(x);
      se.motion.y = float(y);
    } else {
      se.type = kind == "up" ? SDL_EVENT_MOUSE_BUTTON_UP : SDL_EVENT_MOUSE_BUTTON_DOWN;
      se.button.windowID = SDL_GetWindowID(window);
      se.button.button = ev.value("button", 0) == 1 ? SDL_BUTTON_RIGHT : SDL_BUTTON_LEFT;
      se.button.down = kind != "up";
      se.button.clicks = Uint8(ev.value("clicks", 1));
      se.button.x = float(x);
      se.button.y = float(y);
    }
    return SDL_PushEvent(&se) ? "" : SDL_GetError();
  }
  if (type == "mouse") {
    const std::string kind = ev.value("kind", "move");
    const bool right = ev.value("button", 0) == 1;
    NSEventType t = NSEventTypeMouseMoved;
    if (kind == "down") t = right ? NSEventTypeRightMouseDown : NSEventTypeLeftMouseDown;
    if (kind == "up") t = right ? NSEventTypeRightMouseUp : NSEventTypeLeftMouseUp;
    if (kind == "drag") t = right ? NSEventTypeRightMouseDragged : NSEventTypeLeftMouseDragged;
    const NSEventModifierFlags mods = modsFrom(ev);
    const NSInteger clicks = ev.value("clicks", 1);
    const float pressure = kind == "up" ? 0 : 1;
    auto make = [=]() {
      return [NSEvent mouseEventWithType:t location:[win convertPointFromScreen:screenPt]
                           modifierFlags:mods timestamp:NSProcessInfo.processInfo.systemUptime
                            windowNumber:win.windowNumber context:nil eventNumber:0
                              clickCount:clicks pressure:pressure];
    };
    if (delayMs > 0) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, int64_t(delayMs) * NSEC_PER_MSEC),
                     dispatch_get_main_queue(), ^{
                       [NSApp postEvent:make() atStart:NO];
                     });
      return "";
    }
    e = make();
  } else if (type == "key") {
    const bool down = ev.value("down", true);
    const auto kc = (unsigned short)ev.value("keyCode", 0);
    // Sans `chars` : les caractères de la disposition active (layoutChars).
    NSString* chars = ev.contains("chars")
                          ? [NSString stringWithUTF8String:ev["chars"].get<std::string>().c_str()]
                          : layoutChars(kc, modsFrom(ev));
    NSString* raw = ev.contains("charsIgnoring")
                        ? [NSString stringWithUTF8String:ev["charsIgnoring"].get<std::string>().c_str()]
                        : ev.contains("chars") ? chars : layoutChars(kc, modsFrom(ev) & NSEventModifierFlagShift);
    e = [NSEvent keyEventWithType:down ? NSEventTypeKeyDown : NSEventTypeKeyUp location:loc
                    modifierFlags:modsFrom(ev) timestamp:ts windowNumber:win.windowNumber
                          context:nil characters:chars charactersIgnoringModifiers:raw
                        isARepeat:ev.value("repeat", false) keyCode:kc];
  } else if (type == "flags") {
    // SDL3 tient l'état des modificateurs à partir des FlagsChanged (comme le vrai clavier) :
    // keyCode = touche modificatrice (kVK_Command 0x37…), mods = état APRÈS l'appui/relâche.
    e = [NSEvent keyEventWithType:NSEventTypeFlagsChanged location:loc modifierFlags:modsFrom(ev)
                        timestamp:ts windowNumber:win.windowNumber context:nil characters:@""
      charactersIgnoringModifiers:@"" isARepeat:NO keyCode:(unsigned short)ev.value("keyCode", 0)];
  } else if (type == "scroll") {
    const bool precise = ev.value("precise", true);
    CGEventRef cg = CGEventCreateScrollWheelEvent2(
        nullptr, precise ? kCGScrollEventUnitPixel : kCGScrollEventUnitLine, 2,
        ev.value("dy", 0), ev.value("dx", 0), 0);
    CGEventSetLocation(cg, CGPointMake(screenPt.x, NSScreen.screens[0].frame.size.height - screenPt.y));
    e = [NSEvent eventWithCGEvent:cg];
    CFRelease(cg);
  } else if (type == "app") {
    // État de l'app et de la fenêtre (banc des menus), et retour à l'état normal.
    const std::string action = ev.value("action", "state");
    if (action == "keyFor") {  // touche physique qui tape ce caractère dans la disposition active
      NSString* want = [NSString stringWithUTF8String:ev.value("char", "").c_str()];
      for (unsigned short kc = 0; kc < 0x80; ++kc) {
        if ([layoutChars(kc, 0) isEqualToString:want]) return "json:" + std::to_string(kc);
      }
      return "json:-1";
    }
    // Retour à l'état du banc : fenêtre clé de l'app active (SDL3 jette sinon les touches).
    if (action == "unhide") [NSApp unhide:nil];
    if (action == "deminiaturize") [win deminiaturize:nil];
    if (action == "unhide" || action == "deminiaturize") {
      [NSApp activateIgnoringOtherApps:YES];
      [win makeKeyAndOrderFront:nil];
    }
    char buf[160];
    std::snprintf(buf, sizeof buf,
                  "json:{\"hidden\":%s,\"miniaturized\":%s,\"fullscreen\":%s,\"visible\":%s}",
                  NSApp.hidden ? "true" : "false", win.miniaturized ? "true" : "false",
                  (win.styleMask & NSWindowStyleMaskFullScreen) ? "true" : "false",
                  win.visible ? "true" : "false");
    return buf;
  } else if (type == "media") {
    // Touche média telle que la livre le système : NSEventTypeSystemDefined, sous-type 8
    // (NX_SUBTYPE_AUX_CONTROL_BUTTONS), data1 = touche NX_KEYTYPE_* << 16 | appui (0xA) << 8.
    const int key = ev.value("key", 16);  // 16 = NX_KEYTYPE_PLAY
    for (int state : {0xA, 0xB}) {
      NSEvent* m = [NSEvent otherEventWithType:NSEventTypeSystemDefined location:loc
                                 modifierFlags:NSEventModifierFlags(state << 8) timestamp:ts
                                  windowNumber:win.windowNumber context:nil subtype:8
                                         data1:(key << 16) | (state << 8) data2:-1];
      [NSApp postEvent:m atStart:NO];
    }
    return "";
  } else if (type == "ime") {
    // Imite une méthode de saisie : NSTextInputClient de la vue de SDL (setMarkedText /
    // insertText), exactement ce qu'appelle l'IME du système.
    NSResponder* responder = win.firstResponder;
    if (![responder conformsToProtocol:@protocol(NSTextInputClient)]) return "pas de NSTextInputClient";
    id<NSTextInputClient> client = (id<NSTextInputClient>)responder;
    if (ev.contains("marked")) {
      NSString* s = [NSString stringWithUTF8String:ev["marked"].get<std::string>().c_str()];
      [client setMarkedText:s selectedRange:NSMakeRange(s.length, 0)
           replacementRange:NSMakeRange(NSNotFound, 0)];
    } else {
      NSString* s = [NSString stringWithUTF8String:ev.value("insert", "").c_str()];
      [client insertText:s replacementRange:NSMakeRange(NSNotFound, 0)];
    }
    if (ev.value("rect", false)) {
      NSRect r = [client firstRectForCharacterRange:NSMakeRange(0, 0) actualRange:nullptr];
      NSRect w = [win convertRectFromScreen:r];
      return "rect:" + std::to_string(int(w.origin.x)) + "," +
             std::to_string(int(v.bounds.size.height - w.origin.y - w.size.height));
    }
    return "";
  } else {
    return "type inconnu : " + type;
  }
  if (!e) return "évènement non créé";
  // delayMs : postage différé par la file principale de GCD, servie AUSSI pendant les
  // boucles modales d'AppKit (redimensionnement en direct) — pour simuler un geste réel.
  if (delayMs > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, int64_t(delayMs) * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
                     [NSApp postEvent:e atStart:NO];
                   });
  } else {
    [NSApp postEvent:e atStart:NO];
  }
  return "";
}

}  // namespace tentacle::platform
