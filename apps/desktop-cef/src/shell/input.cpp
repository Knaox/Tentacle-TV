#include "shell/input.h"

#include <cmath>
#include <cstdio>
#include <string>

#include "shell/keymap.h"

namespace tentacle {
namespace {

// Repli (Linux/Windows) : SDL3 livre des crans ; Chromium compte 40 px par cran. Sur macOS
// le défilement vient du NSEvent (native_input.h).
constexpr float kWheelPixels = 40.0f;

cef_mouse_button_type_t cefButton(uint8_t b) {
  switch (b) {
    case SDL_BUTTON_RIGHT: return MBT_RIGHT;
    case SDL_BUTTON_MIDDLE: return MBT_MIDDLE;
    default: return MBT_LEFT;
  }
}

std::u16string toUtf16(const char* utf8) {
  std::u16string out;
  const char* p = utf8;
  size_t len = SDL_strlen(utf8);
  while (*p) {
    Uint32 cp = SDL_StepUTF8(&p, &len);
    if (cp >= 0x10000) {
      cp -= 0x10000;
      out.push_back(char16_t(0xD800 + (cp >> 10)));
      out.push_back(char16_t(0xDC00 + (cp & 0x3FF)));
    } else {
      out.push_back(char16_t(cp));
    }
  }
  return out;
}

// TENTACLE_INPUT_LOG=1 : ce que SDL3 livre au socle (diagnostic des bancs).
void logEvent(const SDL_Event& e) {
  switch (e.type) {
    case SDL_EVENT_MOUSE_MOTION: std::fprintf(stderr, "[input] motion %.1f,%.1f\n", e.motion.x, e.motion.y); break;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_BUTTON_UP:
      std::fprintf(stderr, "[input] button %d %s %.1f,%.1f x%d\n", e.button.button,
                   e.button.down ? "down" : "up", e.button.x, e.button.y, e.button.clicks);
      break;
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_KEY_UP:
      std::fprintf(stderr, "[input] key %s sc=%d mod=%x%s\n", e.key.down ? "down" : "up",
                   int(e.key.scancode), unsigned(e.key.mod), e.key.repeat ? " repeat" : "");
      break;
    case SDL_EVENT_TEXT_INPUT: std::fprintf(stderr, "[input] text \"%s\"\n", e.text.text); break;
    case SDL_EVENT_TEXT_EDITING: std::fprintf(stderr, "[input] edit \"%s\"\n", e.edit.text); break;
    case SDL_EVENT_MOUSE_WHEEL: std::fprintf(stderr, "[input] wheel %.2f,%.2f\n", e.wheel.x, e.wheel.y); break;
    case SDL_EVENT_WINDOW_FOCUS_GAINED: std::fprintf(stderr, "[input] focus gained\n"); break;
    case SDL_EVENT_WINDOW_FOCUS_LOST: std::fprintf(stderr, "[input] focus lost\n"); break;
    default: break;
  }
}

}  // namespace

uint32_t cefModifiers(SDL_Keymod mod) {
  uint32_t m = 0;
  if (mod & SDL_KMOD_SHIFT) m |= EVENTFLAG_SHIFT_DOWN;
  if (mod & SDL_KMOD_CTRL) m |= EVENTFLAG_CONTROL_DOWN;
  if (mod & SDL_KMOD_ALT) m |= EVENTFLAG_ALT_DOWN;
  if (mod & SDL_KMOD_GUI) m |= EVENTFLAG_COMMAND_DOWN;
  if (mod & SDL_KMOD_CAPS) m |= EVENTFLAG_CAPS_LOCK_ON;
  if (mod & SDL_KMOD_NUM) m |= EVENTFLAG_NUM_LOCK_ON;
  return m;
}

uint32_t InputRouter::mouseModifiers() const {
  uint32_t m = cefModifiers(SDL_GetModState());
  // L'état réel de SDL, complété par ce que les évènements reçus disent (navigateur : un bouton
  // injecté par un banc — shell.debug.native — n'apparaît pas dans SDL_GetMouseState ; sans
  // lui, Chromium prend un déplacement bouton enfoncé pour un survol et aucun glisser ne naît).
  SDL_MouseButtonFlags b = SDL_GetMouseState(nullptr, nullptr) | pressed_;
  if (b & SDL_BUTTON_LMASK) m |= EVENTFLAG_LEFT_MOUSE_BUTTON;
  if (b & SDL_BUTTON_MMASK) m |= EVENTFLAG_MIDDLE_MOUSE_BUTTON;
  if (b & SDL_BUTTON_RMASK) m |= EVENTFLAG_RIGHT_MOUSE_BUTTON;
  return m;
}

void InputRouter::handle(const SDL_Event& e, CefRefPtr<CefBrowser> browser) {
  static const bool trace = SDL_getenv("TENTACLE_INPUT_LOG") != nullptr;
  if (trace) logEvent(e);
  if (!browser) return;
  auto host = browser->GetHost();
  CefMouseEvent me;
  switch (e.type) {
    case SDL_EVENT_MOUSE_MOTION:
      rawMouseX_ = e.motion.x;
      rawMouseY_ = e.motion.y;
      mouseX_ = e.motion.x;
      mouseY_ = e.motion.y;
      me.x = int(std::lround(mouseX_));
      me.y = int(std::lround(mouseY_));
      me.modifiers = mouseModifiers();
      host->SendMouseMoveEvent(me, false);
      break;
    case SDL_EVENT_WINDOW_MOUSE_LEAVE:
      me.x = int(mouseX_);
      me.y = int(mouseY_);
      me.modifiers = mouseModifiers();
      host->SendMouseMoveEvent(me, true);
      break;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_BUTTON_UP: {
      const bool up = e.type == SDL_EVENT_MOUSE_BUTTON_UP;
      if (up) pressed_ &= ~SDL_BUTTON_MASK(e.button.button);
      else pressed_ |= SDL_BUTTON_MASK(e.button.button);
      me.x = int(std::lround(e.button.x));
      me.y = int(std::lround(e.button.y));
      me.modifiers = mouseModifiers();
      if (!up) host->SetFocus(true);
      if (e.button.button == SDL_BUTTON_X1 || e.button.button == SDL_BUTTON_X2) {
        // Boutons « précédent/suivant » des souris : navigation de l'historique.
        if (!up) e.button.button == SDL_BUTTON_X1 ? browser->GoBack() : browser->GoForward();
        break;
      }
      host->SendMouseClickEvent(me, cefButton(e.button.button), up,
                                std::max<int>(1, e.button.clicks));
      break;
    }
    case SDL_EVENT_MOUSE_WHEEL:
      if (nativeWheel_) break;
      me.x = int(std::lround(e.wheel.mouse_x));
      me.y = int(std::lround(e.wheel.mouse_y));
      me.modifiers = mouseModifiers();
      host->SendMouseWheelEvent(me, int(std::lround(-e.wheel.x * kWheelPixels)),
                                int(std::lround(e.wheel.y * kWheelPixels)));
      break;
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_KEY_UP:
      key(e.key, browser);
      break;
    case SDL_EVENT_TEXT_INPUT:
      text(e.text.text, browser);
      break;
    case SDL_EVENT_TEXT_EDITING:
      editing(e.edit, browser);
      break;
    case SDL_EVENT_WINDOW_FOCUS_GAINED:
      host->SetFocus(true);
      break;
    case SDL_EVENT_WINDOW_FOCUS_LOST:
      host->SetFocus(false);
      break;
    default:
      break;
  }
}

void InputRouter::wheel(const platform::NativeWheel& w, CefRefPtr<CefBrowser> browser) {
  if (!browser) return;
  CefMouseEvent me;
  me.x = int(std::lround(w.x));
  me.y = int(std::lround(w.y));
  me.modifiers = mouseModifiers();
  if (w.precise) me.modifiers |= EVENTFLAG_PRECISION_SCROLLING_DELTA;
  browser->GetHost()->SendMouseWheelEvent(me, int(std::lround(w.dx)), int(std::lround(w.dy)));
}

void InputRouter::key(const SDL_KeyboardEvent& k, CefRefPtr<CefBrowser> browser) {
  // Un modificateur ne se répète pas (macOS : un FlagsChanged par changement) ; SDL3 renvoie
  // pourtant « Maj enfoncée » quand on ajoute ⌥ à Maj. Chromium ne l'envoie pas : nous non plus.
  if (k.repeat && k.scancode >= SDL_SCANCODE_LCTRL && k.scancode <= SDL_SCANCODE_RGUI) return;
  // Pendant une composition IME, la touche appartient à la méthode de saisie (Entrée valide,
  // Échap annule, flèches choisissent) : la page n'en voit ni le keydown ni le keyup — sinon
  // Entrée envoyait le formulaire au lieu de valider la composition.
  if (k.down && composing_) imeKeys_.insert(k.scancode);
  if (imeKeys_.count(k.scancode)) {
    if (!k.down) imeKeys_.erase(k.scancode);
    return;
  }
  const auto nk = keymap::translate(k);
  CefKeyEvent ke;
  ke.native_key_code = nk.nativeCode;
  ke.windows_key_code = nk.windowsCode;
  ke.character = nk.character;
  ke.unmodified_character = nk.unmodified;
  ke.modifiers = cefModifiers(k.mod);
  if (k.repeat) ke.modifiers |= EVENTFLAG_IS_REPEAT;
  if (k.down) {
    lastNativeKey_ = nk.nativeCode;
    ke.type = KEYEVENT_RAWKEYDOWN;
    browser->GetHost()->SendKeyEvent(ke);
    // Entrée : SDL3 ne livre pas de SDL_EVENT_TEXT_INPUT pour « \r » (AppKit en fait la
    // commande insertNewline:). Chromium, lui, envoie RAWKEYDOWN puis CHAR « \r » : c'est
    // le keypress qui déclenche l'envoi implicite d'un formulaire. Pas pendant une
    // composition IME : la touche valide alors la composition, elle n'envoie rien.
    if ((k.scancode == SDL_SCANCODE_RETURN || k.scancode == SDL_SCANCODE_KP_ENTER) && !composing_) {
      ke.type = KEYEVENT_CHAR;
      ke.character = ke.unmodified_character = u'\r';
      ke.windows_key_code = 0x0D;
      browser->GetHost()->SendKeyEvent(ke);
    }
  } else {
    ke.type = KEYEVENT_KEYUP;
    browser->GetHost()->SendKeyEvent(ke);
  }
}

void InputRouter::text(const char* utf8, CefRefPtr<CefBrowser> browser) {
  auto host = browser->GetHost();
  if (composing_) {  // fin de composition IME : le texte définitif remplace la composition
    composing_ = false;
    host->ImeCommitText(CefString(toUtf16(utf8)), CefRange::InvalidRange(), 0);
    return;
  }
  for (char16_t c : toUtf16(utf8)) {
    CefKeyEvent ke;
    ke.type = KEYEVENT_CHAR;
    ke.character = ke.unmodified_character = c;
    ke.windows_key_code = c;
    ke.native_key_code = lastNativeKey_;
    ke.modifiers = cefModifiers(SDL_GetModState());
    host->SendKeyEvent(ke);
  }
}

void InputRouter::editing(const SDL_TextEditingEvent& t, CefRefPtr<CefBrowser> browser) {
  auto host = browser->GetHost();
  const std::u16string comp = t.text ? toUtf16(t.text) : std::u16string();
  if (comp.empty()) {
    // SDL3 vide la composition JUSTE avant de livrer le texte validé (insertText:) : si un
    // SDL_EVENT_TEXT_INPUT attend déjà, c'est une validation, pas une annulation.
    SDL_Event next;
    if (composing_ && SDL_PeepEvents(&next, 1, SDL_PEEKEVENT, SDL_EVENT_TEXT_INPUT,
                                     SDL_EVENT_TEXT_INPUT) > 0) {
      return;
    }
    if (composing_) host->ImeCancelComposition();
    composing_ = false;
    return;
  }
  composing_ = true;
  std::vector<CefCompositionUnderline> underlines;
  CefCompositionUnderline u{};
  u.range = CefRange(0, uint32_t(comp.size()));
  u.color = 0xFF000000;
  u.background_color = 0;
  u.thick = 0;
  underlines.push_back(u);
  const uint32_t caret = uint32_t(std::max(0, t.start));
  host->ImeSetComposition(CefString(comp), underlines, CefRange::InvalidRange(),
                          CefRange(caret, caret + uint32_t(std::max(0, t.length))));
}

}  // namespace tentacle
