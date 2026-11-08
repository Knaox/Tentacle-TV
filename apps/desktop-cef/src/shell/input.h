#pragma once
// Saisie : évènements SDL3 → CefBrowserHost (souris, molette, clavier, texte, IME).
// Coordonnées : SDL3 livre la souris en points de fenêtre, c'est l'unité (DIP) de CEF.

#include <SDL3/SDL.h>

#include <set>

#include "include/cef_browser.h"
#include "shell/native_input.h"

namespace tentacle {

class InputRouter {
 public:
  void handle(const SDL_Event& e, CefRefPtr<CefBrowser> browser);
  // Défilement natif (macOS) : remplace SDL_EVENT_MOUSE_WHEEL une fois activé.
  void setNativeWheel(bool on) { nativeWheel_ = on; }
  void wheel(const platform::NativeWheel& w, CefRefPtr<CefBrowser> browser);

 private:
  uint32_t mouseModifiers() const;
  void key(const SDL_KeyboardEvent& k, CefRefPtr<CefBrowser> browser);
  void text(const char* utf8, CefRefPtr<CefBrowser> browser);
  void editing(const SDL_TextEditingEvent& t, CefRefPtr<CefBrowser> browser);

  float mouseX_ = 0, mouseY_ = 0;
  int lastNativeKey_ = 0;
  bool composing_ = false;
  std::set<int> imeKeys_;  // touches enfoncées pendant une composition (cf. key())
  bool nativeWheel_ = false;
};

uint32_t cefModifiers(SDL_Keymod mod);

}  // namespace tentacle
