// macOS : la vue de contenu du PiP — souris, molette et curseur, transmis à la page du PiP.

#import "platform/macos/compositor_pip_mac.h"

#include "include/internal/cef_types.h"

namespace {

constexpr float kPixelsPerTick = 40.0f;  // Chromium : un cran de molette = 40 px

uint32_t modifiersOf(NSEvent* e) {
  const NSEventModifierFlags f = e.modifierFlags;
  uint32_t m = 0;
  if (f & NSEventModifierFlagShift) m |= EVENTFLAG_SHIFT_DOWN;
  if (f & NSEventModifierFlagControl) m |= EVENTFLAG_CONTROL_DOWN;
  if (f & NSEventModifierFlagOption) m |= EVENTFLAG_ALT_DOWN;
  if (f & NSEventModifierFlagCommand) m |= EVENTFLAG_COMMAND_DOWN;
  if (f & NSEventModifierFlagCapsLock) m |= EVENTFLAG_CAPS_LOCK_ON;
  const NSUInteger buttons = NSEvent.pressedMouseButtons;
  if (buttons & 1) m |= EVENTFLAG_LEFT_MOUSE_BUTTON;
  if (buttons & 2) m |= EVENTFLAG_RIGHT_MOUSE_BUTTON;
  if (buttons & 4) m |= EVENTFLAG_MIDDLE_MOUSE_BUTTON;
  return m;
}

int cefButton(NSEvent* e) {
  switch (e.type) {
    case NSEventTypeRightMouseDown:
    case NSEventTypeRightMouseUp: return MBT_RIGHT;
    case NSEventTypeOtherMouseDown:
    case NSEventTypeOtherMouseUp: return MBT_MIDDLE;
    default: return MBT_LEFT;
  }
}

NSCursor* resizeCursor(NSCursorFrameResizePosition position) API_AVAILABLE(macos(15.0)) {
  return [NSCursor frameResizeCursorFromPosition:position
                                    inDirections:NSCursorFrameResizeDirectionsAll];
}

NSCursor* cursorFor(int type) {
  switch (type) {
    case CT_HAND: return NSCursor.pointingHandCursor;
    case CT_IBEAM: return NSCursor.IBeamCursor;
    case CT_CROSS: return NSCursor.crosshairCursor;
    case CT_NOTALLOWED:
    case CT_NODROP: return NSCursor.operationNotAllowedCursor;
    case CT_GRAB: return NSCursor.openHandCursor;
    case CT_GRABBING:
    case CT_MOVE: return NSCursor.closedHandCursor;
    case CT_EASTWESTRESIZE:
    case CT_EASTRESIZE:
    case CT_WESTRESIZE:
    case CT_COLUMNRESIZE: return NSCursor.resizeLeftRightCursor;
    case CT_NORTHSOUTHRESIZE:
    case CT_NORTHRESIZE:
    case CT_SOUTHRESIZE:
    case CT_ROWRESIZE: return NSCursor.resizeUpDownCursor;
    default: break;
  }
  if (@available(macOS 15.0, *)) {
    switch (type) {
      case CT_NORTHWESTRESIZE:
      case CT_SOUTHEASTRESIZE:
      case CT_NORTHWESTSOUTHEASTRESIZE: return resizeCursor(NSCursorFrameResizePositionTopLeft);
      case CT_NORTHEASTRESIZE:
      case CT_SOUTHWESTRESIZE:
      case CT_NORTHEASTSOUTHWESTRESIZE: return resizeCursor(NSCursorFrameResizePositionTopRight);
      default: break;
    }
  }
  return NSCursor.arrowCursor;
}

}  // namespace

@implementation TentaclePipView {
  tentacle::pip::PageInput input_;
  NSTrackingArea* tracking_;
  NSCursor* cursor_;
  BOOL hidden_;  // CT_NONE : le curseur caché au-dessus du PiP
  BOOL inside_;
  NSPoint last_;
}

- (instancetype)initWithFrame:(NSRect)frame input:(tentacle::pip::PageInput)input {
  if ((self = [super initWithFrame:frame])) {
    input_ = std::move(input);
    cursor_ = NSCursor.arrowCursor;
  }
  return self;
}

- (BOOL)isFlipped {
  return YES;  // origine en haut à gauche, comme la vue de CEF
}
// Le premier clic, application inactive, va au bouton visé (`acceptFirstMouse` d'Electron).
- (BOOL)acceptsFirstMouse:(NSEvent*)event {
  return YES;
}
- (BOOL)acceptsFirstResponder {
  return YES;
}

- (void)updateTrackingAreas {
  [super updateTrackingAreas];
  if (tracking_) [self removeTrackingArea:tracking_];
  // ActiveAlways : le survol arrive aussi application inactive, au niveau normal compris
  // (Electron relayait le curseur à 30 Hz pour cela, `pipDocking.ts`).
  tracking_ = [[NSTrackingArea alloc]
      initWithRect:NSZeroRect
           options:NSTrackingMouseEnteredAndExited | NSTrackingMouseMoved |
                   NSTrackingCursorUpdate | NSTrackingActiveAlways | NSTrackingInVisibleRect
             owner:self
          userInfo:nil];
  [self addTrackingArea:tracking_];
}

- (void)detach {
  input_ = {};
  [self showCursor];
}

- (NSPoint)pointOf:(NSEvent*)e {
  return [self convertPoint:e.locationInWindow fromView:nil];
}

- (void)moveFor:(NSEvent*)e leave:(BOOL)leave {
  const NSPoint p = leave ? last_ : [self pointOf:e];
  last_ = p;
  if (input_.mouseMove) input_.mouseMove(p.x, p.y, modifiersOf(e), leave);
}

- (void)mouseEntered:(NSEvent*)e {
  inside_ = YES;
  [self moveFor:e leave:NO];
  [self applyCursor];
}
- (void)mouseExited:(NSEvent*)e {
  inside_ = NO;
  [self moveFor:e leave:YES];
  [self showCursor];
}
- (void)mouseMoved:(NSEvent*)e {
  [self moveFor:e leave:NO];
}
- (void)mouseDragged:(NSEvent*)e {
  [self moveFor:e leave:NO];
}
- (void)rightMouseDragged:(NSEvent*)e {
  [self moveFor:e leave:NO];
}
- (void)otherMouseDragged:(NSEvent*)e {
  [self moveFor:e leave:NO];
}

- (void)button:(NSEvent*)e up:(BOOL)up {
  const NSPoint p = [self pointOf:e];
  last_ = p;
  if (input_.mouseButton) {
    input_.mouseButton(p.x, p.y, modifiersOf(e), cefButton(e), up,
                       (int)MAX(1, e.clickCount));
  }
}
- (void)mouseDown:(NSEvent*)e {
  [self button:e up:NO];
}
- (void)mouseUp:(NSEvent*)e {
  [self button:e up:YES];
}
- (void)rightMouseDown:(NSEvent*)e {
  [self button:e up:NO];
}
- (void)rightMouseUp:(NSEvent*)e {
  [self button:e up:YES];
}
- (void)otherMouseDown:(NSEvent*)e {
  [self button:e up:NO];
}
- (void)otherMouseUp:(NSEvent*)e {
  [self button:e up:YES];
}

- (void)scrollWheel:(NSEvent*)e {
  if (!input_.wheel) return;
  const NSPoint p = [self pointOf:e];
  const bool precise = e.hasPreciseScrollingDeltas;
  const float k = precise ? 1.0f : kPixelsPerTick;
  uint32_t m = modifiersOf(e);
  if (precise) m |= EVENTFLAG_PRECISION_SCROLLING_DELTA;
  input_.wheel(p.x, p.y, m, e.scrollingDeltaX * k, e.scrollingDeltaY * k);
}

// Le PiP n'a pas de clavier : rien ne part vers la page, et AppKit ne bipe pas.
- (void)keyDown:(NSEvent*)e {
}
- (void)keyUp:(NSEvent*)e {
}

- (void)cursorUpdate:(NSEvent*)e {
  [self applyCursor];
}

- (void)setCefCursor:(int)type {
  if (type == CT_NONE) {
    if (inside_ && !hidden_) {
      [NSCursor hide];
      hidden_ = YES;
    }
    return;
  }
  [self showCursor];
  cursor_ = cursorFor(type);
  [self applyCursor];
}

- (void)applyCursor {
  if (inside_ && !hidden_) [cursor_ set];
}

- (void)showCursor {
  if (!hidden_) return;
  [NSCursor unhide];
  hidden_ = NO;
}

@end
