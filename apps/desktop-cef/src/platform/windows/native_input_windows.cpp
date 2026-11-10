// Windows : défilement natif (shell/native_input.h) et injection d'évènements pour les bancs.
//
// Défilement : SDL3 ramène WM_MOUSEWHEEL à des crans (delta / 120) et le socle les multiplie
// par 40 px — Chromium, lui, fait défiler `lignes par cran` × 100/3 px (le réglage « Faire
// défiler N lignes » de Windows, 3 par défaut : 100 px), et la moitié d'un cran d'un pavé
// tactile de précision vaut la moitié de ce pas. On lit donc le message tel quel, par le
// crochet de messages de SDL, avec la règle de Chromium (web_input_event_builders_win.cc) :
// même vitesse qu'Electron, Maj + molette = défilement horizontal, inclinaison (MOUSEHWHEEL).

#include <windows.h>
#include <windowsx.h>

#include <SDL3/SDL.h>

#include <string>

#include "shell/native_input.h"

namespace tentacle::platform {
namespace {

HWND g_hwnd = nullptr;
std::function<void(const NativeWheel&)> g_sink;

float pixelsPerNotch() {
  UINT lines = 3;
  SystemParametersInfoW(SPI_GETWHEELSCROLLLINES, 0, &lines, 0);
  // WHEEL_PAGESCROLL (« un écran à la fois ») : Chromium y fait défiler une page ; le socle
  // n'a pas la hauteur de la page ici, on garde trois lignes, la valeur par défaut.
  if (lines == WHEEL_PAGESCROLL || lines == 0) lines = 3;
  return float(lines) * 100.0f / 3.0f;
}

bool SDLCALL onMessage(void*, MSG* m) {
  if (!g_sink || m->hwnd != g_hwnd) return true;
  if (m->message != WM_MOUSEWHEEL && m->message != WM_MOUSEHWHEEL) return true;
  POINT p{GET_X_LPARAM(m->lParam), GET_Y_LPARAM(m->lParam)};  // écran, en pixels
  ScreenToClient(g_hwnd, &p);
  const UINT dpi = GetDpiForWindow(g_hwnd);
  const float toDip = dpi ? 96.0f / float(dpi) : 1.0f;
  const int delta = GET_WHEEL_DELTA_WPARAM(m->wParam);
  const float d = float(delta) / float(WHEEL_DELTA) * pixelsPerNotch();
  NativeWheel w;
  w.x = float(p.x) * toDip;
  w.y = float(p.y) * toDip;
  if (m->message == WM_MOUSEHWHEEL) {
    w.dx = -d;  // incliner à droite fait défiler vers la droite (deltaX négatif pour CEF)
  } else if (GET_KEYSTATE_WPARAM(m->wParam) & MK_SHIFT) {
    w.dx = d;
  } else {
    w.dy = d;
  }
  // Un pavé tactile de précision envoie des fractions de cran : défilement continu.
  w.precise = (delta % WHEEL_DELTA) != 0;
  g_sink(w);
  return false;  // consommé : SDL n'en fait pas un second SDL_EVENT_MOUSE_WHEEL
}

// Banc : un message posté à notre propre fenêtre, qui suit ensuite le vrai chemin (file de
// messages → SDL → socle → CEF), comme l'injection NSEvent de macOS.
std::string post(UINT msg, WPARAM wp, LPARAM lp) {
  return PostMessageW(g_hwnd, msg, wp, lp) ? std::string() : "PostMessage a échoué";
}

LPARAM clientPoint(SDL_Window* window, const Json& ev) {
  // x, y en DIP (comme la page) → pixels de la zone client.
  const UINT dpi = GetDpiForWindow(g_hwnd);
  const float k = dpi ? float(dpi) / 96.0f : 1.0f;
  const int x = int(ev.value("x", 0.0) * k), y = int(ev.value("y", 0.0) * k);
  return MAKELPARAM(x, y);
}

}  // namespace

bool installNativeWheel(SDL_Window* window, std::function<void(const NativeWheel&)> sink) {
  g_hwnd = static_cast<HWND>(
      SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
  if (!g_hwnd) return false;
  g_sink = std::move(sink);
  SDL_SetWindowsMessageHook(&onMessage, nullptr);
  return true;
}

void uninstallNativeWheel() {
  SDL_SetWindowsMessageHook(nullptr, nullptr);
  g_sink = nullptr;
}

// Sous-ensemble de shell.debug.native (macOS : shell_native_input_mac.mm) :
//   {type:"key", vk, down?, chars?}    WM_KEYDOWN/WM_KEYUP (+ WM_CHAR pour chaque caractère) ;
//   {type:"text", chars}               WM_CHAR seuls ;
//   {type:"scroll", x, y, dy, dx?}     WM_MOUSEWHEEL / WM_MOUSEHWHEEL (crans de 120) ;
//   {type:"mouse", x, y, action:"move"|"down"|"up", button?:"left"|"right"}.
std::string injectNative(SDL_Window* window, const Json& ev) {
  if (!g_hwnd) return "fenêtre inconnue";
  const std::string type = ev.value("type", "");
  if (type == "key") {
    const WPARAM vk = WPARAM(ev.value("vk", 0));
    const UINT scan = MapVirtualKeyW(UINT(vk), MAPVK_VK_TO_VSC);
    const bool down = ev.value("down", true);
    const LPARAM lp = LPARAM(1u | (scan << 16) | (down ? 0u : (3u << 30)));
    if (auto e = post(down ? WM_KEYDOWN : WM_KEYUP, vk, lp); !e.empty()) return e;
    if (!down || !ev.contains("chars")) return {};
  } else if (type != "text" && type != "scroll" && type != "mouse") {
    return "type non pris en charge sous Windows : " + type;
  }
  if (type == "key" || type == "text") {
    const std::string chars = ev.value("chars", "");
    const int n = MultiByteToWideChar(CP_UTF8, 0, chars.data(), int(chars.size()), nullptr, 0);
    std::wstring w(size_t(n), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, chars.data(), int(chars.size()), w.data(), n);
    for (wchar_t c : w)
      if (auto e = post(WM_CHAR, WPARAM(c), 1); !e.empty()) return e;
    return {};
  }
  POINT screen{GET_X_LPARAM(clientPoint(window, ev)), GET_Y_LPARAM(clientPoint(window, ev))};
  if (type == "scroll") {
    ClientToScreen(g_hwnd, &screen);  // WM_MOUSEWHEEL porte des coordonnées d'écran
    const LPARAM at = MAKELPARAM(screen.x, screen.y);
    if (const int dx = int(ev.value("dx", 0.0) * WHEEL_DELTA))
      if (auto e = post(WM_MOUSEHWHEEL, MAKEWPARAM(0, dx), at); !e.empty()) return e;
    if (const int dy = int(ev.value("dy", 0.0) * WHEEL_DELTA)) return post(WM_MOUSEWHEEL, MAKEWPARAM(0, dy), at);
    return {};
  }
  const std::string action = ev.value("action", "move");
  const bool right = ev.value("button", "left") == "right";
  const LPARAM at = clientPoint(window, ev);
  if (action == "move") return post(WM_MOUSEMOVE, 0, at);
  if (action == "down") return post(right ? WM_RBUTTONDOWN : WM_LBUTTONDOWN, right ? MK_RBUTTON : MK_LBUTTON, at);
  if (action == "up") return post(right ? WM_RBUTTONUP : WM_LBUTTONUP, 0, at);
  return "action inconnue : " + action;
}

}  // namespace tentacle::platform
