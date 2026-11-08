#pragma once
// Code DOM/VK (windows_key_code de CEF) à partir d'un keycode SDL — commun aux OS.
// CEF Windows et Linux s'en servent pour keyCode ; CEF Mac le recalcule depuis le NSEvent.

#include <SDL3/SDL.h>

namespace tentacle::keymap {

inline int windowsKeyCode(SDL_Keycode k) {
  if (k >= SDLK_A && k <= SDLK_Z) return int(k - SDLK_A + 'A');
  if (k >= SDLK_0 && k <= SDLK_9) return int(k);
  if (k >= SDLK_F1 && k <= SDLK_F12) return 0x70 + int(k - SDLK_F1);
  switch (k) {
    case SDLK_BACKSPACE: return 0x08;
    case SDLK_TAB: return 0x09;
    case SDLK_RETURN: case SDLK_KP_ENTER: return 0x0D;
    case SDLK_LSHIFT: case SDLK_RSHIFT: return 0x10;
    case SDLK_LCTRL: case SDLK_RCTRL: return 0x11;
    case SDLK_LALT: case SDLK_RALT: return 0x12;
    case SDLK_PAUSE: return 0x13;
    case SDLK_CAPSLOCK: return 0x14;
    case SDLK_ESCAPE: return 0x1B;
    case SDLK_SPACE: return 0x20;
    case SDLK_PAGEUP: return 0x21;
    case SDLK_PAGEDOWN: return 0x22;
    case SDLK_END: return 0x23;
    case SDLK_HOME: return 0x24;
    case SDLK_LEFT: return 0x25;
    case SDLK_UP: return 0x26;
    case SDLK_RIGHT: return 0x27;
    case SDLK_DOWN: return 0x28;
    case SDLK_INSERT: return 0x2D;
    case SDLK_DELETE: return 0x2E;
    case SDLK_LGUI: case SDLK_RGUI: return 0x5B;
    case SDLK_SEMICOLON: return 0xBA;
    case SDLK_EQUALS: return 0xBB;
    case SDLK_COMMA: return 0xBC;
    case SDLK_MINUS: return 0xBD;
    case SDLK_PERIOD: return 0xBE;
    case SDLK_SLASH: return 0xBF;
    case SDLK_GRAVE: return 0xC0;
    case SDLK_LEFTBRACKET: return 0xDB;
    case SDLK_BACKSLASH: return 0xDC;
    case SDLK_RIGHTBRACKET: return 0xDD;
    case SDLK_APOSTROPHE: return 0xDE;
    default: return 0;
  }
}

}  // namespace tentacle::keymap
