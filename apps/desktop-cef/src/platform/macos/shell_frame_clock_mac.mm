// macOS : CADisplayLink de la vue SDL → BeginFrame externe de CEF (voir shell/frame_clock.h).

#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>

#include "shell/frame_clock.h"

@interface TentacleFrameClock : NSObject
- (instancetype)initWithView:(NSView*)view tick:(std::function<void()>)tick;
- (void)stop;
- (void)setMode:(tentacle::platform::FrameClockMode)mode;
@end

@implementation TentacleFrameClock {
  __weak NSView* view_;
  std::function<void()> tick_;
  CADisplayLink* link_;
  NSMutableArray* observers_;
  tentacle::platform::FrameClockMode mode_;
  NSTimer* probe_;  // veille profonde : BeginFrame de sondage, lien suspendu
}

- (instancetype)initWithView:(NSView*)view tick:(std::function<void()>)tick {
  if ((self = [super init])) {
    view_ = view;
    tick_ = std::move(tick);
    observers_ = [NSMutableArray array];
    [self rebuild];
    // Après une mise en veille de l'écran ou un changement d'écran, l'ancien lien peut cesser
    // de battre (ère 3 de la référence : « the UI looks frozen ») : on le reconstruit.
    __weak TentacleFrameClock* weakSelf = self;
    void (^rebuild)(NSNotification*) = ^(NSNotification*) { [weakSelf rebuild]; };
    [observers_ addObject:[NSWorkspace.sharedWorkspace.notificationCenter
                              addObserverForName:NSWorkspaceDidWakeNotification object:nil
                                           queue:NSOperationQueue.mainQueue usingBlock:rebuild]];
    [observers_ addObject:[NSNotificationCenter.defaultCenter
                              addObserverForName:NSApplicationDidChangeScreenParametersNotification
                                          object:nil queue:NSOperationQueue.mainQueue
                                      usingBlock:rebuild]];
  }
  return self;
}

- (void)rebuild {
  [link_ invalidate];
  NSView* v = view_;
  if (!v) return;
  // Lien de la VUE (macOS 14+) : il suit l'écran sur lequel se trouve la fenêtre.
  link_ = [v displayLinkWithTarget:self selector:@selector(onTick:)];
  [self applyRate];
  [link_ addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}

- (void)setMode:(tentacle::platform::FrameClockMode)mode {
  if (mode == mode_) return;
  mode_ = mode;
  [self applyRate];
}

- (void)applyRate {
  using tentacle::platform::FrameClockMode;
  // Au repos, le fil principal, le GPU et le Renderer ne se réveillent plus 120 fois par
  // seconde pour une page immobile (voir shell/frame_clock.h).
  const float hz = tentacle::platform::kIdleFrameClockHz;
  link_.preferredFrameRateRange =
      mode_ == FrameClockMode::full ? CAFrameRateRangeDefault : CAFrameRateRangeMake(hz, hz, hz);
  link_.paused = mode_ == FrameClockMode::deepIdle;
  if (mode_ != FrameClockMode::deepIdle) {
    [probe_ invalidate];
    probe_ = nil;
  } else if (!probe_) {
    __weak TentacleFrameClock* weakSelf = self;
    probe_ = [NSTimer timerWithTimeInterval:1.0 / tentacle::platform::kDeepIdleFrameClockHz
                                    repeats:YES
                                      block:^(NSTimer*) { [weakSelf onTick:nil]; }];
    probe_.tolerance = 0.02;  // laisse macOS regrouper les réveils
    [NSRunLoop.mainRunLoop addTimer:probe_ forMode:NSRunLoopCommonModes];
  }
}

- (void)onTick:(CADisplayLink*)link {
  if (tick_) tick_();
}

- (void)stop {
  [link_ invalidate];
  link_ = nil;
  [probe_ invalidate];
  probe_ = nil;
  for (id o in observers_) {
    [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:o];
    [NSNotificationCenter.defaultCenter removeObserver:o];
  }
  [observers_ removeAllObjects];
  tick_ = nullptr;
}

@end

namespace tentacle::platform {
namespace {
TentacleFrameClock* g_clock = nil;
}

bool frameClockSupported() { return true; }

bool startFrameClock(SDL_Window* window, std::function<void()> tick) {
  NSWindow* win = (__bridge NSWindow*)SDL_GetPointerProperty(
      SDL_GetWindowProperties(window), SDL_PROP_WINDOW_COCOA_WINDOW_POINTER, nullptr);
  if (!win || g_clock) return false;
  g_clock = [[TentacleFrameClock alloc] initWithView:win.contentView tick:std::move(tick)];
  return true;
}

void stopFrameClock() {
  [g_clock stop];
  g_clock = nil;
}

void setFrameClockMode(FrameClockMode mode) { [g_clock setMode:mode]; }

}  // namespace tentacle::platform
