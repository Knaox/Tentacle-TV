// macOS : les blocages d'économie d'énergie, par IOPMAssertion — ce que fait le
// `powerSaveBlocker` de Chromium sous Electron : l'écran (PreventUserIdleDisplaySleep) pendant
// la lecture, le système (PreventUserIdleSystemSleep) pendant les transferts.

#import <Foundation/Foundation.h>
#import <IOKit/pwr_mgt/IOPMLib.h>

#include <unistd.h>

#include <map>

#include "lifecycle/lifecycle_platform.h"

namespace tentacle::lifecycle::platform {
namespace {

class MacSleepBlocker final : public SleepBlocker {
 public:
  int start(BlockerKind kind) override {
    const bool display = kind == BlockerKind::PreventDisplaySleep;
    IOPMAssertionID assertion = kIOPMNullAssertionID;
    const IOReturn r = IOPMAssertionCreateWithName(
        display ? kIOPMAssertPreventUserIdleDisplaySleep : kIOPMAssertPreventUserIdleSystemSleep,
        kIOPMAssertionLevelOn,
        display ? CFSTR("Prevent display sleep") : CFSTR("Prevent app suspension"), &assertion);
    const int id = next_++;
    // Un échec du système ne se rattrape pas ici : l'identifiant reste « non posé »
    // (`isStarted` faux), et le prochain `prevent` réessaiera.
    if (r == kIOReturnSuccess) assertions_[id] = assertion;
    return id;
  }
  void stop(int id) override {
    auto it = assertions_.find(id);
    if (it == assertions_.end()) return;
    IOPMAssertionRelease(it->second);
    assertions_.erase(it);
  }
  bool isStarted(int id) const override { return assertions_.count(id) > 0; }

 private:
  int next_ = 1;
  std::map<int, IOPMAssertionID> assertions_;
};

}  // namespace

SleepBlocker& sleepBlocker() {
  static MacSleepBlocker blocker;
  return blocker;
}

Launcher logindLauncher() { return {}; }  // pas de logind sur macOS

long currentPid() { return long(getpid()); }

}  // namespace tentacle::lifecycle::platform
