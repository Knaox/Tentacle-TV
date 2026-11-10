// Pompe CEF de Windows (external_message_pump, fil principal) : une fenêtre de messages
// cachée (HWND_MESSAGE) reçoit le réveil de CEF et sa minuterie.
//
// Pourquoi pas un évènement SDL (message_pump_sdl.cpp, Linux) : sous Windows, déplacer ou
// redimensionner la fenêtre fait entrer le fil principal dans la boucle MODALE de Win32
// (DefWindowProc → WM_ENTERSIZEMOVE), qui ne rend la main à SDL_WaitEvent qu'au lâcher de la
// souris — la page se figeait pendant tout le geste (la référence le note : « the Win32 modal
// resize loop blocks our main event loop »). Cette boucle modale distribue en revanche TOUS
// les messages du fil, dont ceux de notre fenêtre cachée : CEF continue de travailler, la page
// de peindre, et le compositeur de présenter — comme la run loop de macOS (« common modes »).
// C'est le montage de cefclient (main_message_loop_external_pump_win.cc), et la raison pour
// laquelle CEF n'a pas besoin de son propre fil (multi_threaded_message_loop) ici : un seul
// fil UI, comme macOS et Linux, et `postToMain` garde son sens partout.
//
// SDL_WaitEvent dort dans MsgWaitForMultipleObjects : un message posté le réveille, SDL le
// distribue (DispatchMessage), et CefDoMessageLoopWork s'exécute dans notre procédure.

#include <windows.h>

#include <algorithm>
#include <climits>

#include "include/cef_app.h"
#include "shell/message_pump.h"

namespace tentacle {
namespace {

constexpr UINT kWorkMessage = WM_APP + 0x0CEF;
constexpr UINT_PTR kTimerId = 1;
// Sans demande de CEF, un passage au moins toutes les 33 ms (30 Hz), comme cefclient : CEF
// ne redemande pas toujours du travail après une tâche différée qu'il a lui-même postée.
constexpr int64_t kMaxIdleDelayMs = 1000 / 30;
constexpr wchar_t kClassName[] = L"TentacleCefPump";

class MessagePumpWin final : public MessagePump {
 public:
  MessagePumpWin() {
    HINSTANCE inst = GetModuleHandleW(nullptr);
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof wc;
    wc.lpfnWndProc = &MessagePumpWin::proc;
    wc.hInstance = inst;
    wc.lpszClassName = kClassName;
    RegisterClassExW(&wc);  // déjà enregistrée : sans effet
    hwnd_ = CreateWindowExW(0, kClassName, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, inst, nullptr);
    SetWindowLongPtrW(hwnd_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));
  }

  ~MessagePumpWin() override {
    if (!hwnd_) return;
    KillTimer(hwnd_, kTimerId);
    SetWindowLongPtrW(hwnd_, GWLP_USERDATA, 0);
    DestroyWindow(hwnd_);
  }

  // N'importe quel fil (OnScheduleMessagePumpWork) : on ne fait que poster.
  void scheduleWork(int64_t delayMs) override {
    if (!hwnd_) return;
    const LPARAM delay = LPARAM(std::clamp<int64_t>(delayMs, 0, INT_MAX));
    PostMessageW(hwnd_, kWorkMessage, 0, delay);
  }

 private:
  static LRESULT CALLBACK proc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    auto* self = reinterpret_cast<MessagePumpWin*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (self) {
      if (msg == kWorkMessage) {
        self->handleSchedule(int64_t(lp));
        return 0;
      }
      if (msg == WM_TIMER && wp == kTimerId) {
        self->killTimer();
        self->doWork();
        return 0;
      }
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
  }

  void handleSchedule(int64_t delayMs) {
    if (delayMs <= 0) {
      killTimer();
      doWork();
    } else {
      setTimer(delayMs);
    }
  }

  void doWork() {
    // Réentrance (une tâche de CEF ouvre une boucle modale : dialogue, menu) : on note et on
    // repasse juste après, sans appeler CefDoMessageLoopWork dans lui-même.
    if (active_) {
      reentered_ = true;
      return;
    }
    active_ = true;
    reentered_ = false;
    CefDoMessageLoopWork();
    active_ = false;
    if (reentered_) {
      PostMessageW(hwnd_, kWorkMessage, 0, 0);
    } else if (!timerPending_) {
      setTimer(kMaxIdleDelayMs);
    }
  }

  void setTimer(int64_t delayMs) {
    // Une seule minuterie : la plus proche gagne, comme cefclient (SetTimer la remplace).
    timerPending_ = true;
    SetTimer(hwnd_, kTimerId, UINT(std::max<int64_t>(delayMs, USER_TIMER_MINIMUM)), nullptr);
  }

  void killTimer() {
    if (!timerPending_) return;
    KillTimer(hwnd_, kTimerId);
    timerPending_ = false;
  }

  HWND hwnd_ = nullptr;
  bool active_ = false;      // fil principal seulement
  bool reentered_ = false;
  bool timerPending_ = false;
};

}  // namespace

std::unique_ptr<MessagePump> MessagePump::create() { return std::make_unique<MessagePumpWin>(); }

}  // namespace tentacle
