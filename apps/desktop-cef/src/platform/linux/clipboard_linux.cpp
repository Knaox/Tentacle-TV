// Presse-papiers sous Linux, pour le rendu hors écran.
//
// Mesuré au banc (sway) : Chromium hors écran n'atteint PAS le presse-papiers du système, ni
// par Ozone Wayland ni en headless — il n'a aucune surface au focus, et Wayland ne donne le
// presse-papiers qu'au client qui a le clavier. C'est notre fenêtre SDL qui l'a : le pont
// passe par elle (SDL_SetClipboardText / SDL_GetClipboardText), comme la référence (ère C++).
//  - copier, couper, navigator.clipboard.writeText : la page pousse le texte (script injecté) ;
//  - coller (Ctrl+V, Ctrl+Maj+V, Maj+Inser) : la page demande le texte et l'insère (évènement
//    `paste`, puis insertText si personne ne l'a annulé).
// Droits d'Electron (security.ts : écriture du presse-papiers seule) : la LECTURE n'est rendue
// que dans la seconde qui suit une vraie frappe de collage vue par SDL — jamais à un script.

#include <SDL3/SDL.h>

#include <atomic>
#include <string>

#include "platform/linux/linux_commands.h"
#include "shell/ipc.h"

namespace tentacle::platform {
namespace {

std::atomic<uint64_t> g_lastPasteKeyMs{0};

bool onEvent(void*, SDL_Event* e) {
  if (e->type != SDL_EVENT_KEY_DOWN) return true;
  const SDL_Keymod m = e->key.mod;
  const bool ctrlV = (m & SDL_KMOD_CTRL) && !(m & (SDL_KMOD_ALT | SDL_KMOD_GUI)) && e->key.key == SDLK_V;
  const bool shiftInsert = (m & SDL_KMOD_SHIFT) && e->key.key == SDLK_INSERT;
  if (ctrlV || shiftInsert) g_lastPasteKeyMs = SDL_GetTicks();
  return true;
}

constexpr const char* kScript = R"JS((() => {
  const shell = window.__shell;
  if (!shell || window.__tentacleLinuxClipboard) return;
  window.__tentacleLinuxClipboard = true;
  const push = (t) => { if (t) shell.invoke('linux.clipboard.set', { text: String(t) }).catch(() => {}); };
  const selected = () => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.selectionStart === 'number') {
      return el.type === 'password' ? '' : el.value.substring(el.selectionStart, el.selectionEnd);
    }
    return String(getSelection() || '');
  };
  // Phase de capture : le texte coupé est encore là.
  for (const type of ['copy', 'cut']) document.addEventListener(type, () => push(selected()), true);
  const cb = navigator.clipboard;
  if (cb && cb.writeText) {
    const write = cb.writeText.bind(cb);
    cb.writeText = (t) => { push(t); return write(t).catch(() => {}); };
  }
  document.addEventListener('keydown', (e) => {
    const ctrlV = e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'v' || e.key === 'V');
    if (!(ctrlV || (e.shiftKey && e.key === 'Insert')) || e.defaultPrevented) return;
    e.preventDefault();
    shell.invoke('linux.clipboard.get', {}).then((text) => {
      if (typeof text !== 'string' || !text) return;
      const target = document.activeElement || document.body;
      const data = new DataTransfer();
      data.setData('text/plain', text);
      const ev = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      if (target.dispatchEvent(ev)) document.execCommand('insertText', false, text);
    }).catch(() => {});
  }, true);
})();)JS";

}  // namespace

void installClipboardBridge() {
  SDL_AddEventWatch(onEvent, nullptr);
  ipc::registerHandler("linux.clipboard.set", [](const Json& p, ipc::Responder r) {
    if (p.is_object() && p.contains("text") && p["text"].is_string()) {
      SDL_SetClipboardText(p["text"].get<std::string>().c_str());
    }
    r.reply();
  });
  ipc::registerHandler("linux.clipboard.get", [](const Json&, ipc::Responder r) {
    // Seulement juste après une frappe de collage réelle (Electron : aucune lecture par script).
    if (SDL_GetTicks() - g_lastPasteKeyMs.load() > 1000) return r.fail("refused", "lecture du presse-papiers refusée");
    char* text = SDL_GetClipboardText();
    r.reply(std::string(text ? text : ""));
    SDL_free(text);
  });
  ipc::registerInjectedScript(kScript);
}

}  // namespace tentacle::platform
