// Pompe CEF générique (Linux, Windows) : réveil de SDL_WaitEvent par un évènement SDL
// utilisateur, minuteur SDL pour le travail différé. Sur ces OS il n'y a pas de run loop
// native servant les boucles modales : la boucle SDL fait tout. Même logique que la pompe
// macOS (shell_message_pump_mac.mm, calquée sur cefclient) : repli à 250 ms, et relance
// immédiate quand une passe a duré ~10 ms (sinon CEF « se coince », voir doWork). Linux : le
// contexte GLib par défaut (pompe UI de Chromium) est servi à chaque passe
// (platform/linux/glib_pump_linux.h).

#include <SDL3/SDL.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <mutex>

#include "include/cef_app.h"
#include "shell/message_pump.h"
#ifdef __linux__
#include "platform/linux/glib_pump_linux.h"  // le contexte GLib de Chromium, servi ici
#endif

namespace tentacle {
namespace {

using Clock = std::chrono::steady_clock;

// Repli : CEF peut perdre un réveil (documenté par cefclient) ; on retravaille au plus tard
// après ce délai même sans demande. 1/30 s chez cefclient ; 250 ms ici pour un repos sobre.
constexpr int64_t kMaxDelayMs = 250;

class MessagePumpSdl final : public MessagePump {
 public:
  MessagePumpSdl() : event_(SDL_RegisterEvents(1)) {
#ifdef __linux__
    platform::startGlibBridge([this] { wake(); });
#endif
    setTimer(kMaxDelayMs);
  }
  ~MessagePumpSdl() override {
    std::lock_guard lk(m_);
    if (timer_) SDL_RemoveTimer(timer_);
    timer_ = 0;
#ifdef __linux__
    platform::stopGlibBridge();
#endif
  }

  // N'importe quel fil.
  void scheduleWork(int64_t delayMs) override {
    if (trace_) std::fprintf(stderr, "[pompe] demande %lld ms\n", (long long)delayMs);
    if (delayMs <= 0) {
      wake();
    } else {
      setTimer(delayMs);
    }
  }

  bool handleSdlEvent(uint32_t type) override {
    if (type != event_) return false;
    doWork();
    return true;
  }

 private:
  void doWork() {
    if (active_) {
      // Réentrance (boucle modale ouverte depuis CefDoMessageLoopWork) : on repassera.
      reentered_ = true;
      return;
    }
    if (trace_) std::fprintf(stderr, "[pompe] travail\n");
    active_ = true;
#ifdef __linux__
    platform::serviceGlib();  // descripteurs de la pompe MessagePumpGlib du fil UI de Chromium
#endif
    const auto t0 = Clock::now();
    CefDoMessageLoopWork();
    const auto spent = Clock::now() - t0;
#ifdef __linux__
    platform::armGlib();
#endif
    active_ = false;
    // MessagePumpExternal::Run coupe après 10 ms en laissant du travail immédiat, et son
    // WorkDeduplicator avale alors les ScheduleWork suivants (« pump wedge », référence
    // 9954a71) : au-delà de ~10 ms, on se relance nous-mêmes. Mesuré sous Linux (banc sway) :
    // sans cela, UNE demande au démarrage puis plus rien, navigateur jamais créé.
    if (reentered_ || spent >= std::chrono::milliseconds(9)) {
      reentered_ = false;
      wake();
    } else {
      setTimer(kMaxDelayMs);
    }
  }

  // Programme un réveil dans `delayMs` ; ne repousse jamais un réveil plus proche déjà prévu
  // quand il ne s'agit que du repli. N'importe quel fil.
  void setTimer(int64_t delayMs) {
    std::lock_guard lk(m_);
    const auto fire = Clock::now() + std::chrono::milliseconds(delayMs);
    if (timer_ && delayMs >= kMaxDelayMs && deadline_ < fire) return;
    if (timer_) SDL_RemoveTimer(timer_);
    deadline_ = fire;
    timer_ = SDL_AddTimer(Uint32(delayMs), &MessagePumpSdl::onTimer, this);
  }

  static Uint32 onTimer(void* self, SDL_TimerID id, Uint32) {
    auto* p = static_cast<MessagePumpSdl*>(self);
    {
      std::lock_guard lk(p->m_);
      if (p->timer_ == id) p->timer_ = 0;
    }
    p->wake();
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
  std::mutex m_;  // timer_, deadline_
  SDL_TimerID timer_ = 0;
  Clock::time_point deadline_{};
  bool active_ = false, reentered_ = false;  // fil principal
};

}  // namespace

std::unique_ptr<MessagePump> MessagePump::create() { return std::make_unique<MessagePumpSdl>(); }

}  // namespace tentacle
