// Pompe CEF générique (Linux, Windows) : réveil de SDL_WaitEvent par un évènement SDL
// utilisateur, minuteur SDL pour le travail différé. Sur ces OS il n'y a pas de run loop
// native servant les boucles modales : la boucle SDL fait tout. Linux : le contexte GLib par
// défaut (pompe UI de Chromium) est servi à chaque passe (platform/linux/glib_pump_linux.h).

#include <SDL3/SDL.h>

#include <atomic>
#include <cstdio>
#include <cstdlib>

#include "include/cef_app.h"
#include "shell/message_pump.h"
#ifdef __linux__
#include "platform/linux/glib_pump_linux.h"  // le contexte GLib de Chromium, servi ici
#endif

namespace tentacle {
namespace {

class MessagePumpSdl final : public MessagePump {
 public:
  MessagePumpSdl() : event_(SDL_RegisterEvents(1)) {
#ifdef __linux__
    platform::startGlibBridge([this] { wake(); });
#endif
  }
  ~MessagePumpSdl() override {
    if (timer_) SDL_RemoveTimer(timer_);
#ifdef __linux__
    platform::stopGlibBridge();
#endif
  }

  void scheduleWork(int64_t delayMs) override {
    if (trace_) std::fprintf(stderr, "[pompe] demande %lld ms\n", (long long)delayMs);
    if (delayMs <= 0) {
      wake();
      return;
    }
    if (SDL_TimerID old = timer_.exchange(0)) SDL_RemoveTimer(old);
    timer_ = SDL_AddTimer(Uint32(delayMs), &MessagePumpSdl::onTimer, this);
  }

  bool handleSdlEvent(uint32_t type) override {
    if (type != event_) return false;
    if (trace_) std::fprintf(stderr, "[pompe] travail\n");
#ifdef __linux__
    platform::serviceGlib();  // la pompe MessagePumpGlib du fil UI de Chromium
#endif
    CefDoMessageLoopWork();
#ifdef __linux__
    platform::armGlib();
#endif
    return true;
  }

 private:
  static Uint32 onTimer(void* self, SDL_TimerID, Uint32) {
    static_cast<MessagePumpSdl*>(self)->wake();
    return 0;
  }
  void wake() {
    SDL_Event e{};
    e.type = event_;
    SDL_PushEvent(&e);
  }

  const uint32_t event_;
  // TENTACLE_PUMP_TRACE=1 : chaque demande de CEF et chaque passe de travail (diagnostic).
  const bool trace_ = std::getenv("TENTACLE_PUMP_TRACE") != nullptr;
  std::atomic<SDL_TimerID> timer_{0};
};

}  // namespace

std::unique_ptr<MessagePump> MessagePump::create() { return std::make_unique<MessagePumpSdl>(); }

}  // namespace tentacle
