// Scancodes SDL (USB HID) → codes de touche virtuels macOS (kVK_*, HIToolbox/Events.h).
// Les touches de fonction reçoivent les caractères Unicode privés d'AppKit (NSUpArrowFunctionKey…)
// pour que CEF reconstruise un NSEvent fidèle.

#include "shell/keymap.h"
#include "shell/keymap_common.h"

namespace tentacle::keymap {
namespace {

struct Entry {
  SDL_Scancode sc;
  int vk;
  char16_t fn;  // caractère AppKit imposé (touches non imprimables), 0 sinon
};

constexpr Entry kTable[] = {
    {SDL_SCANCODE_A, 0x00, 0}, {SDL_SCANCODE_S, 0x01, 0}, {SDL_SCANCODE_D, 0x02, 0},
    {SDL_SCANCODE_F, 0x03, 0}, {SDL_SCANCODE_H, 0x04, 0}, {SDL_SCANCODE_G, 0x05, 0},
    {SDL_SCANCODE_Z, 0x06, 0}, {SDL_SCANCODE_X, 0x07, 0}, {SDL_SCANCODE_C, 0x08, 0},
    {SDL_SCANCODE_V, 0x09, 0}, {SDL_SCANCODE_NONUSBACKSLASH, 0x0A, 0},
    {SDL_SCANCODE_B, 0x0B, 0}, {SDL_SCANCODE_Q, 0x0C, 0}, {SDL_SCANCODE_W, 0x0D, 0},
    {SDL_SCANCODE_E, 0x0E, 0}, {SDL_SCANCODE_R, 0x0F, 0}, {SDL_SCANCODE_Y, 0x10, 0},
    {SDL_SCANCODE_T, 0x11, 0}, {SDL_SCANCODE_1, 0x12, 0}, {SDL_SCANCODE_2, 0x13, 0},
    {SDL_SCANCODE_3, 0x14, 0}, {SDL_SCANCODE_4, 0x15, 0}, {SDL_SCANCODE_6, 0x16, 0},
    {SDL_SCANCODE_5, 0x17, 0}, {SDL_SCANCODE_EQUALS, 0x18, 0}, {SDL_SCANCODE_9, 0x19, 0},
    {SDL_SCANCODE_7, 0x1A, 0}, {SDL_SCANCODE_MINUS, 0x1B, 0}, {SDL_SCANCODE_8, 0x1C, 0},
    {SDL_SCANCODE_0, 0x1D, 0}, {SDL_SCANCODE_RIGHTBRACKET, 0x1E, 0},
    {SDL_SCANCODE_O, 0x1F, 0}, {SDL_SCANCODE_U, 0x20, 0},
    {SDL_SCANCODE_LEFTBRACKET, 0x21, 0}, {SDL_SCANCODE_I, 0x22, 0},
    {SDL_SCANCODE_P, 0x23, 0}, {SDL_SCANCODE_RETURN, 0x24, 0x0D}, {SDL_SCANCODE_L, 0x25, 0},
    {SDL_SCANCODE_J, 0x26, 0}, {SDL_SCANCODE_APOSTROPHE, 0x27, 0}, {SDL_SCANCODE_K, 0x28, 0},
    {SDL_SCANCODE_SEMICOLON, 0x29, 0}, {SDL_SCANCODE_BACKSLASH, 0x2A, 0},
    {SDL_SCANCODE_COMMA, 0x2B, 0}, {SDL_SCANCODE_SLASH, 0x2C, 0}, {SDL_SCANCODE_N, 0x2D, 0},
    {SDL_SCANCODE_M, 0x2E, 0}, {SDL_SCANCODE_PERIOD, 0x2F, 0}, {SDL_SCANCODE_TAB, 0x30, 0x09},
    {SDL_SCANCODE_SPACE, 0x31, 0}, {SDL_SCANCODE_GRAVE, 0x32, 0},
    {SDL_SCANCODE_BACKSPACE, 0x33, 0x7F}, {SDL_SCANCODE_ESCAPE, 0x35, 0x1B},
    {SDL_SCANCODE_RGUI, 0x36, 0}, {SDL_SCANCODE_LGUI, 0x37, 0}, {SDL_SCANCODE_LSHIFT, 0x38, 0},
    {SDL_SCANCODE_CAPSLOCK, 0x39, 0}, {SDL_SCANCODE_LALT, 0x3A, 0},
    {SDL_SCANCODE_LCTRL, 0x3B, 0}, {SDL_SCANCODE_RSHIFT, 0x3C, 0}, {SDL_SCANCODE_RALT, 0x3D, 0},
    {SDL_SCANCODE_RCTRL, 0x3E, 0}, {SDL_SCANCODE_F17, 0x40, 0xF714},
    {SDL_SCANCODE_KP_PERIOD, 0x41, 0}, {SDL_SCANCODE_KP_MULTIPLY, 0x43, 0},
    {SDL_SCANCODE_KP_PLUS, 0x45, 0}, {SDL_SCANCODE_NUMLOCKCLEAR, 0x47, 0xF739},
    {SDL_SCANCODE_KP_DIVIDE, 0x4B, 0}, {SDL_SCANCODE_KP_ENTER, 0x4C, 0x03},
    {SDL_SCANCODE_KP_MINUS, 0x4E, 0}, {SDL_SCANCODE_F18, 0x4F, 0xF715},
    {SDL_SCANCODE_F19, 0x50, 0xF716}, {SDL_SCANCODE_KP_EQUALS, 0x51, 0},
    {SDL_SCANCODE_KP_0, 0x52, 0}, {SDL_SCANCODE_KP_1, 0x53, 0}, {SDL_SCANCODE_KP_2, 0x54, 0},
    {SDL_SCANCODE_KP_3, 0x55, 0}, {SDL_SCANCODE_KP_4, 0x56, 0}, {SDL_SCANCODE_KP_5, 0x57, 0},
    {SDL_SCANCODE_KP_6, 0x58, 0}, {SDL_SCANCODE_KP_7, 0x59, 0},
    {SDL_SCANCODE_F20, 0x5A, 0xF717}, {SDL_SCANCODE_KP_8, 0x5B, 0},
    {SDL_SCANCODE_KP_9, 0x5C, 0}, {SDL_SCANCODE_INTERNATIONAL3, 0x5D, 0},
    {SDL_SCANCODE_INTERNATIONAL1, 0x5E, 0}, {SDL_SCANCODE_KP_COMMA, 0x5F, 0},
    {SDL_SCANCODE_F5, 0x60, 0xF708}, {SDL_SCANCODE_F6, 0x61, 0xF709},
    {SDL_SCANCODE_F7, 0x62, 0xF70A}, {SDL_SCANCODE_F3, 0x63, 0xF706},
    {SDL_SCANCODE_F8, 0x64, 0xF70B}, {SDL_SCANCODE_F9, 0x65, 0xF70C},
    {SDL_SCANCODE_LANG2, 0x66, 0}, {SDL_SCANCODE_F11, 0x67, 0xF70E},
    {SDL_SCANCODE_LANG1, 0x68, 0}, {SDL_SCANCODE_F13, 0x69, 0xF710},
    {SDL_SCANCODE_F16, 0x6A, 0xF713}, {SDL_SCANCODE_F14, 0x6B, 0xF711},
    {SDL_SCANCODE_F10, 0x6D, 0xF70D}, {SDL_SCANCODE_APPLICATION, 0x6E, 0},
    {SDL_SCANCODE_F12, 0x6F, 0xF70F}, {SDL_SCANCODE_F15, 0x71, 0xF712},
    {SDL_SCANCODE_INSERT, 0x72, 0xF727}, {SDL_SCANCODE_HOME, 0x73, 0xF729},
    {SDL_SCANCODE_PAGEUP, 0x74, 0xF72C}, {SDL_SCANCODE_DELETE, 0x75, 0xF728},
    {SDL_SCANCODE_F4, 0x76, 0xF707}, {SDL_SCANCODE_END, 0x77, 0xF72B},
    {SDL_SCANCODE_F2, 0x78, 0xF705}, {SDL_SCANCODE_PAGEDOWN, 0x79, 0xF72D},
    {SDL_SCANCODE_F1, 0x7A, 0xF704}, {SDL_SCANCODE_LEFT, 0x7B, 0xF702},
    {SDL_SCANCODE_RIGHT, 0x7C, 0xF703}, {SDL_SCANCODE_DOWN, 0x7D, 0xF701},
    {SDL_SCANCODE_UP, 0x7E, 0xF700},
};

char16_t keyChar(SDL_Keycode k) {
  // Les keycodes SDL imprimables sont des points de code Unicode (plan de base ici).
  return (k > 0 && k < 0xD800 && !(k & SDLK_SCANCODE_MASK)) ? char16_t(k) : 0;
}

}  // namespace

NativeKey translate(const SDL_KeyboardEvent& ev) {
  NativeKey out;
  for (const auto& e : kTable) {
    if (e.sc != ev.scancode) continue;
    out.nativeCode = e.vk;
    if (e.fn) out.character = out.unmodified = e.fn;
    break;
  }
  if (!out.character) {
    out.unmodified = keyChar(SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false));
    out.character = keyChar(SDL_GetKeyFromScancode(ev.scancode, ev.mod, false));
    if (!out.character) out.character = out.unmodified;
  }
  out.windowsCode = windowsKeyCode(SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false));
  return out;
}

}  // namespace tentacle::keymap
