// macOS : diagnostic de la fenêtre PiP pour les bancs — son état en une ligne, et des
// évènements de souris NATIFS postés dans SA file (NSApp postEvent:) : ils suivent le vrai
// chemin (AppKit → TentaclePipView → page du PiP) sans toucher au curseur de l'écran.

#import "platform/macos/compositor_pip_mac.h"

#include <string>

namespace tentacle::pip::mac {

std::string describeWindow(NSWindow* window) {
  const NSWindowCollectionBehavior b = window.collectionBehavior;
  NSString* out = [NSString
      stringWithFormat:@"level=%ld key=%d visible=%d allSpaces=%d fullScreenAux=%d opaque=%d "
                       @"shadow=%d resizable=%d title=%@",
                       (long)window.level, window.keyWindow, window.visible,
                       (b & NSWindowCollectionBehaviorCanJoinAllSpaces) != 0,
                       (b & NSWindowCollectionBehaviorFullScreenAuxiliary) != 0, window.opaque,
                       window.hasShadow, (window.styleMask & NSWindowStyleMaskResizable) != 0,
                       window.title];
  return out.UTF8String;
}

std::string injectInto(NSWindow* window, const std::string& kind, double x, double y, int clicks,
                       double dy) {
  NSView* view = window.contentView;
  // Points de la vue (origine en haut à gauche) → fenêtre.
  const NSPoint inWindow = [view convertPoint:NSMakePoint(x, y) toView:nil];
  if (kind == "scroll") {
    CGEventRef cg = CGEventCreateScrollWheelEvent2(nullptr, kCGScrollEventUnitPixel, 1,
                                                   int32_t(dy), 0, 0);
    const NSPoint screen = [window convertPointToScreen:inWindow];
    CGEventSetLocation(cg, CGPointMake(screen.x, NSScreen.screens[0].frame.size.height - screen.y));
    CGEventSetIntegerValueField(cg, kCGMouseEventWindowUnderMousePointer, window.windowNumber);
    CGEventSetIntegerValueField(cg, kCGMouseEventWindowUnderMousePointerThatCanHandleThisEvent,
                                window.windowNumber);
    NSEvent* e = [NSEvent eventWithCGEvent:cg];
    CFRelease(cg);
    // Le défilement d'un CGEvent n'a pas de fenêtre : remis directement à la vue visée.
    [view scrollWheel:e];
    return "";
  }
  NSEventType type = NSEventTypeMouseMoved;
  if (kind == "down") type = NSEventTypeLeftMouseDown;
  else if (kind == "up") type = NSEventTypeLeftMouseUp;
  else if (kind == "drag") type = NSEventTypeLeftMouseDragged;
  else if (kind != "move") return "type inconnu : " + kind;
  NSEvent* e = [NSEvent mouseEventWithType:type
                                  location:inWindow
                             modifierFlags:0
                                 timestamp:NSProcessInfo.processInfo.systemUptime
                              windowNumber:window.windowNumber
                                   context:nil
                               eventNumber:0
                                clickCount:clicks
                                  pressure:kind == "up" || kind == "move" ? 0 : 1];
  // Le survol (mouseMoved) va au premier répondant ; un clic à la vue sous le point.
  if (type == NSEventTypeMouseMoved) {
    [view mouseMoved:e];
    return "";
  }
  [NSApp postEvent:e atStart:NO];
  return "";
}

}  // namespace tentacle::pip::mac
