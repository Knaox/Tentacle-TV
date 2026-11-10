// Windows : touche SDL → ce que CEF attend d'un WM_KEYDOWN (cefclient, osr_window_win.cc) :
//   windows_key_code = le code virtuel (wParam) — celui de la DISPOSITION active, pas de la
//                      position : un AZERTY donne VK 'A' à la touche Q du QWERTY ;
//   native_key_code  = le lParam du message : répétition, code de balayage, bit « étendu »,
//                      état précédent, transition. Chromium en tire `KeyboardEvent.code`.
// SDL3 garde le code de balayage dans `raw` (0xE0xx pour une touche étendue : flèches, pavé
// d'édition, Ctrl et Alt de droite…), ce qui suffit à reconstruire l'un et l'autre.

#include <windows.h>

#include "include/internal/cef_types.h"
#include "shell/keymap.h"
#include "shell/keymap_common.h"

namespace tentacle::keymap {
namespace {

// Pavé numérique, verrou numérique allumé : SDL donne le chiffre (SDLK_KP_*), Windows le
// VK_NUMPAD* ; le code de balayage seul (MapVirtualKey) rendrait la fonction d'édition.
int keypadVk(SDL_Keycode k) {
  if (k >= SDLK_KP_1 && k <= SDLK_KP_9) return VK_NUMPAD1 + int(k - SDLK_KP_1);
  switch (k) {
    case SDLK_KP_0: return VK_NUMPAD0;
    case SDLK_KP_PERIOD: case SDLK_KP_DECIMAL: return VK_DECIMAL;
    case SDLK_KP_DIVIDE: return VK_DIVIDE;
    case SDLK_KP_MULTIPLY: return VK_MULTIPLY;
    case SDLK_KP_MINUS: return VK_SUBTRACT;
    case SDLK_KP_PLUS: return VK_ADD;
    case SDLK_KP_ENTER: return VK_RETURN;
    default: return 0;
  }
}

bool isKeypadScancode(SDL_Scancode sc) { return sc >= SDL_SCANCODE_KP_DIVIDE && sc <= SDL_SCANCODE_KP_PERIOD; }

}  // namespace

NativeKey translate(const SDL_KeyboardEvent& ev) {
  NativeKey k;
  UINT scan = ev.raw;
  if (scan == 0) scan = MapVirtualKeyW(UINT(windowsKeyCode(ev.key)), MAPVK_VK_TO_VSC_EX);  // touche virtuelle
  const bool extended = (scan & 0xFF00) == 0xE000 || (scan & 0xFF00) == 0xE100;

  int vk = keypadVk(ev.key);
  if (!vk) vk = int(MapVirtualKeyW(scan, MAPVK_VSC_TO_VK_EX));  // disposition active du fil
  if (!vk) vk = windowsKeyCode(ev.key);                         // repli : table commune
  // WM_KEYDOWN porte le code GÉNÉRIQUE des modificateurs ; le côté passe par les drapeaux.
  switch (vk) {
    case VK_LSHIFT: vk = VK_SHIFT; k.extraModifiers |= EVENTFLAG_IS_LEFT; break;
    case VK_RSHIFT: vk = VK_SHIFT; k.extraModifiers |= EVENTFLAG_IS_RIGHT; break;
    case VK_LCONTROL: vk = VK_CONTROL; k.extraModifiers |= EVENTFLAG_IS_LEFT; break;
    case VK_RCONTROL: vk = VK_CONTROL; k.extraModifiers |= EVENTFLAG_IS_RIGHT; break;
    case VK_LMENU: vk = VK_MENU; k.extraModifiers |= EVENTFLAG_IS_LEFT; break;
    case VK_RMENU: vk = VK_MENU; k.extraModifiers |= EVENTFLAG_IS_RIGHT; break;
    case VK_LWIN: k.extraModifiers |= EVENTFLAG_IS_LEFT; break;
    case VK_RWIN: k.extraModifiers |= EVENTFLAG_IS_RIGHT; break;
    default: break;
  }
  if (isKeypadScancode(ev.scancode)) k.extraModifiers |= EVENTFLAG_IS_KEY_PAD;

  // lParam de WM_KEYDOWN / WM_KEYUP (bits : 0-15 répétitions, 16-23 balayage, 24 étendue,
  // 29 Alt enfoncée, 30 état précédent, 31 transition).
  uint32_t lp = 1u | ((scan & 0xFFu) << 16);
  if (extended) lp |= 1u << 24;
  if ((ev.mod & SDL_KMOD_ALT) && !(ev.mod & SDL_KMOD_CTRL)) lp |= 1u << 29;
  if (ev.repeat) lp |= 1u << 30;
  if (!ev.down) lp |= (1u << 30) | (1u << 31);
  k.nativeCode = int(lp);
  k.windowsCode = vk;
  // Les caractères arrivent par WM_CHAR (SDL_EVENT_TEXT_INPUT) ; ceux-ci ne servent qu'aux
  // évènements de touche, que Chromium Windows n'interprète pas.
  k.unmodified = char16_t(SDL_GetKeyFromScancode(ev.scancode, SDL_KMOD_NONE, false) & 0xFFFF);
  k.character = char16_t(SDL_GetKeyFromScancode(ev.scancode, ev.mod, false) & 0xFFFF);
  return k;
}

}  // namespace tentacle::keymap
