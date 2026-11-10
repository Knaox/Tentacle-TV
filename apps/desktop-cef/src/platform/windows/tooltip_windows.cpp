// Bulle d'aide Windows : le contrôle natif TOOLTIPS_CLASS en mode « suivi » (TTF_TRACK |
// TTF_ABSOLUTE), possédé par la fenêtre de l'app, placé sous le curseur — ce que fait Chromium
// sous Windows (`views::corewm::TooltipWin`) et donc Electron. Délai : celui du système
// (TTDT_INITIAL = durée du double-clic).

#include <SDL3/SDL.h>
#include <windows.h>
#include <commctrl.h>

#include <string>

#include "shell/tooltip.h"

namespace tentacle::platform {
namespace {

constexpr int kMaxWidthPx = 400;  // au-delà, la bulle passe à la ligne

std::wstring wide(const std::string& s) {
  if (s.empty()) return {};
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), nullptr, 0);
  std::wstring out(size_t(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), out.data(), n);
  return out;
}

class WinTooltip final : public TooltipWindow {
 public:
  explicit WinTooltip(HWND parent) : parent_(parent) {
    INITCOMMONCONTROLSEX icc{sizeof(icc), ICC_WIN95_CLASSES};
    InitCommonControlsEx(&icc);
    tip_ = CreateWindowExW(WS_EX_TOPMOST | WS_EX_NOACTIVATE, TOOLTIPS_CLASSW, nullptr,
                           WS_POPUP | TTS_NOPREFIX | TTS_ALWAYSTIP, CW_USEDEFAULT, CW_USEDEFAULT,
                           CW_USEDEFAULT, CW_USEDEFAULT, parent_, nullptr,
                           GetModuleHandleW(nullptr), nullptr);
    if (!tip_) return;
    // Taille V2 : acceptée par les Common Controls 5 comme 6 (le manifeste décide).
    ti_.cbSize = TTTOOLINFOW_V2_SIZE;
    ti_.uFlags = TTF_IDISHWND | TTF_TRACK | TTF_ABSOLUTE;
    ti_.hwnd = parent_;
    ti_.uId = reinterpret_cast<UINT_PTR>(parent_);
    ti_.lpszText = const_cast<wchar_t*>(L"");
    SendMessageW(tip_, TTM_ADDTOOLW, 0, reinterpret_cast<LPARAM>(&ti_));
    SendMessageW(tip_, TTM_SETMAXTIPWIDTH, 0, kMaxWidthPx);
  }
  ~WinTooltip() override {
    if (tip_) DestroyWindow(tip_);
  }

  void show(const std::string& text, float x, float y) override {
    if (!tip_) return;
    // Comme la bulle du système : rien pour une fenêtre qui n'est pas au premier plan.
    if (GetForegroundWindow() != parent_) return;
    text_ = wide(text);
    ti_.lpszText = text_.data();
    SendMessageW(tip_, TTM_UPDATETIPTEXTW, 0, reinterpret_cast<LPARAM>(&ti_));
    // Coordonnées de SDL sous Windows : des pixels de la zone cliente.
    POINT pt{LONG(x), LONG(y)};
    ClientToScreen(parent_, &pt);
    pt.y += GetSystemMetrics(SM_CYCURSOR) / 2 + 4;  // sous la pointe du curseur
    SendMessageW(tip_, TTM_TRACKPOSITION, 0, MAKELPARAM(pt.x, pt.y));
    SendMessageW(tip_, TTM_TRACKACTIVATE, TRUE, reinterpret_cast<LPARAM>(&ti_));
    visible_ = true;
  }

  void hide() override {
    if (tip_ && visible_) SendMessageW(tip_, TTM_TRACKACTIVATE, FALSE, reinterpret_cast<LPARAM>(&ti_));
    visible_ = false;
  }

  bool visible() const override { return visible_; }

 private:
  HWND parent_;
  HWND tip_ = nullptr;
  TOOLINFOW ti_{};
  std::wstring text_;
  bool visible_ = false;
};

}  // namespace

std::unique_ptr<TooltipWindow> createTooltipWindow(SDL_Window* parent) {
  auto hwnd = static_cast<HWND>(SDL_GetPointerProperty(SDL_GetWindowProperties(parent),
                                                       SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
  if (!hwnd) return nullptr;
  return std::make_unique<WinTooltip>(hwnd);
}

int tooltipDelayMs() { return int(GetDoubleClickTime()); }

}  // namespace tentacle::platform
