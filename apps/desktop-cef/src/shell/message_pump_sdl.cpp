// Pompe CEF générique (Linux, Windows — non construite ici) : réveil de SDL_WaitEvent par
// un évènement SDL utilisateur, minuteur SDL pour le travail différé. Sur ces OS il n'y a
// pas de run loop native servant les boucles modales : la boucle SDL fait tout.

#include <SDL3/SDL.h>

#include <atomic>

#include "include/cef_app.h"
#include "shell/message_pump.h"

namespace tentacle {
namespace {

class MessagePumpSdl final : public MessagePump {
 public:
  MessagePumpSdl() : event_(SDL_RegisterEvents(1)) {}
  ~MessagePumpSdl() override {
    if (timer_) SDL_RemoveTimer(timer_);
  }

  void scheduleWork(int64_t delayMs) override {
    if (delayMs <= 0) {
      wake();
      return;
    }
    if (SDL_TimerID old = timer_.exchange(0)) SDL_RemoveTimer(old);
    timer_ = SDL_AddTimer(Uint32(delayMs), &MessagePumpSdl::onTimer, this);
  }

  bool handleSdlEvent(uint32_t type) override {
    if (type != event_) return false;
    CefDoMessageLoopWork();
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
  std::atomic<SDL_TimerID> timer_{0};
};

}  // namespace

std::unique_ptr<MessagePump> MessagePump::create() { return std::make_unique<MessagePumpSdl>(); }

}  // namespace tentacle
