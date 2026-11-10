#pragma once
// Traduction des touches SDL vers ce qu'attend CEF hors écran sur chaque OS.
// macOS : CEF reconstruit un NSEvent à partir de native_key_code (kVK_*), character et
// unmodified_character — les trois doivent être remplis (sinon CEF fabrique un
// NSEventTypeFlagsChanged et la touche est perdue ; correctif 54ebe6e de la référence).

#include <SDL3/SDL.h>

#include <cstdint>

namespace tentacle::keymap {

struct NativeKey {
  int nativeCode = 0;          // macOS : kVK_* ; Windows : scancode ; Linux : keycode X11
  int windowsCode = 0;         // VK_* (DOM keyCode)
  char16_t character = 0;      // caractère avec modificateurs
  char16_t unmodified = 0;     // caractère sans modificateurs
  // Drapeaux CEF de position (EVENTFLAG_IS_LEFT/RIGHT/KEY_PAD) : Windows les tire du code de
  // balayage, comme Chromium (KeyboardEvent.location) ; 0 sur macOS (CEF les recalcule).
  uint32_t extraModifiers = 0;
};

NativeKey translate(const SDL_KeyboardEvent& ev);

}  // namespace tentacle::keymap
