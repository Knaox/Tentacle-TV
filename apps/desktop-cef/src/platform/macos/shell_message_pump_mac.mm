// Pompe CEF macOS, calquée sur MainMessageLoopExternalPumpMac de cefclient, mais branchée
// sur la run loop principale de Core Foundation plutôt que sur des évènements SDL.
//
// Pourquoi : SDL_WaitEvent dort dans -[NSApp nextEventMatchingMask:] qui fait tourner la
// run loop ; un bloc/minuteur posé en kCFRunLoopCommonModes s'y exécute SANS réveiller la
// boucle SDL. Et surtout il s'exécute AUSSI pendant le redimensionnement en direct et les
// menus (NSEventTrackingRunLoopMode, boucle modale d'AppKit où la boucle SDL est bloquée) :
// la page continue de peindre pendant qu'on tire le coin de la fenêtre. La référence (ère
// C++) devait, elle, pomper CEF depuis un « event watch » SDL sur EXPOSED pendant le resize.

#import <Foundation/Foundation.h>

#include <chrono>

#include "include/cef_app.h"
#include "shell/message_pump.h"

namespace tentacle {
namespace {

// Repli : CEF peut perdre un réveil (documenté par cefclient) ; on retravaille au plus tard
// après ce délai même sans demande. 1/30 s chez cefclient ; 250 ms ici pour un repos sobre.
constexpr double kMaxDelaySec = 0.25;

class MessagePumpMac final : public MessagePump {
 public:
  MessagePumpMac() {
    runLoop_ = CFRunLoopGetMain();
    timer_ = CFRunLoopTimerCreateWithHandler(
        kCFAllocatorDefault, CFAbsoluteTimeGetCurrent() + kMaxDelaySec, 1.0e9, 0, 0,
        ^(CFRunLoopTimerRef) {
          doWork();
        });
    CFRunLoopAddTimer(runLoop_, timer_, kCFRunLoopCommonModes);
  }

  ~MessagePumpMac() override {
    CFRunLoopTimerInvalidate(timer_);
    CFRelease(timer_);
  }

  void scheduleWork(int64_t delayMs) override {
    // N'importe quel fil → fil principal, dans tous les modes de run loop.
    CFRunLoopPerformBlock(runLoop_, kCFRunLoopCommonModes, ^{
      onSchedule(delayMs);
    });
    CFRunLoopWakeUp(runLoop_);
  }

 private:
  void onSchedule(int64_t delayMs) {
    if (delayMs <= 0) {
      doWork();
    } else {
      setTimer(delayMs / 1000.0);
    }
  }

  void doWork() {
    if (active_) {
      // Réentrance (boucle modale ouverte depuis CefDoMessageLoopWork) : on repassera.
      reentered_ = true;
      return;
    }
    active_ = true;
    auto t0 = std::chrono::steady_clock::now();
    CefDoMessageLoopWork();
    auto spent = std::chrono::steady_clock::now() - t0;
    active_ = false;
    // MessagePumpExternal::Run coupe après 10 ms en laissant du travail immédiat, et son
    // WorkDeduplicator avale alors les ScheduleWork suivants (« pump wedge » corrigé par la
    // référence en 9954a71) : si on a dépassé ~10 ms, on se relance nous-mêmes.
    if (reentered_ || spent >= std::chrono::milliseconds(9)) {
      reentered_ = false;
      setTimer(0);
    } else {
      setTimer(kMaxDelaySec);
    }
  }

  void setTimer(double sec) {
    CFAbsoluteTime fire = CFAbsoluteTimeGetCurrent() + sec;
    // Ne jamais repousser un réveil plus proche déjà programmé.
    if (sec >= kMaxDelaySec && CFRunLoopTimerGetNextFireDate(timer_) < fire) return;
    CFRunLoopTimerSetNextFireDate(timer_, fire);
  }

  CFRunLoopRef runLoop_;
  CFRunLoopTimerRef timer_;
  bool active_ = false;
  bool reentered_ = false;
};

}  // namespace

std::unique_ptr<MessagePump> MessagePump::create() { return std::make_unique<MessagePumpMac>(); }

}  // namespace tentacle
