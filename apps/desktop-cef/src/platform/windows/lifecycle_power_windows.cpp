// Windows : les blocages d'économie d'énergie, par les « power requests » du système — ce que
// fait le `powerSaveBlocker` de Chromium sous Electron (`power_save_blocker_win.cc`) :
// PowerRequestDisplayRequired pour l'écran (la lecture), PowerRequestExecutionRequired pour le
// système (les transferts). Une requête par blocage : les deux cohabitent sans se marcher dessus.
//
// ⚠️ Pourquoi pas le `stop-screensaver` de mpv : sa fenêtre est une ENFANT, et Windows n'envoie
// SC_SCREENSAVE / SC_MONITORPOWER qu'à la fenêtre de premier plan (`powerSave.ts`).

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0602  // PowerRequestExecutionRequired : Windows 8
#endif
#include <windows.h>

#include <map>

#include "lifecycle/lifecycle_platform.h"

namespace tentacle::lifecycle::platform {
namespace {

class WinSleepBlocker final : public SleepBlocker {
 public:
  int start(BlockerKind kind) override {
    const int id = next_++;
    const bool display = kind == BlockerKind::PreventDisplaySleep;
    wchar_t reason[] = L"Tentacle TV";
    REASON_CONTEXT context{};
    context.Version = POWER_REQUEST_CONTEXT_VERSION;
    context.Flags = POWER_REQUEST_CONTEXT_SIMPLE_STRING;
    context.Reason.SimpleReasonString = reason;
    HANDLE request = PowerCreateRequest(&context);
    if (request == INVALID_HANDLE_VALUE) return id;  // non posé : le prochain `prevent` réessaie
    const POWER_REQUEST_TYPE type = display ? PowerRequestDisplayRequired : PowerRequestExecutionRequired;
    if (!PowerSetRequest(request, type)) {
      CloseHandle(request);
      return id;
    }
    requests_[id] = {request, type};
    return id;
  }
  void stop(int id) override {
    auto it = requests_.find(id);
    if (it == requests_.end()) return;
    PowerClearRequest(it->second.handle, it->second.type);
    CloseHandle(it->second.handle);
    requests_.erase(it);
  }
  bool isStarted(int id) const override { return requests_.count(id) > 0; }

 private:
  struct Request {
    HANDLE handle;
    POWER_REQUEST_TYPE type;
  };
  int next_ = 1;
  std::map<int, Request> requests_;
};

}  // namespace

SleepBlocker& sleepBlocker() {
  static WinSleepBlocker blocker;
  return blocker;
}

Launcher logindLauncher() { return {}; }  // pas de logind sous Windows

long currentPid() { return long(GetCurrentProcessId()); }

}  // namespace tentacle::lifecycle::platform
