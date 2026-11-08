#pragma once
// Pompe de messages CEF en mode external_message_pump.
//
// Pourquoi ce mode : sur macOS, le fil UI de Chromium DOIT être le fil principal (celui
// d'AppKit) ; multi_threaded_message_loop n'existe pas sur macOS. Et nous ne voulons pas
// que CefRunMessageLoop possède la boucle : SDL3 la possède (SDL_WaitEvent). CEF nous dit
// donc quand travailler (OnScheduleMessagePumpWork, depuis n'importe quel fil) et nous
// appelons CefDoMessageLoopWork sur le fil principal.

#include <cstdint>
#include <memory>

namespace tentacle {

class MessagePump {
 public:
  static std::unique_ptr<MessagePump> create();
  virtual ~MessagePump() = default;
  // N'importe quel fil. delayMs <= 0 : dès que possible.
  virtual void scheduleWork(int64_t delayMs) = 0;
  // Fil principal : traite un évènement SDL propre à la pompe (plateformes sans run loop
  // native). Renvoie true s'il a été consommé.
  virtual bool handleSdlEvent(uint32_t type) { return false; }
};

}  // namespace tentacle
