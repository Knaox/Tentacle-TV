#pragma once
// Script d'amorçage exécuté le premier dans chaque contexte JS du cadre principal.
// Il reçoit `window.__shellNative` (fonctions natives send/register posées juste avant),
// le retire de window, et expose window.__shell (gelé, non énumérable).

namespace tentacle::renderer {

inline constexpr char kBootstrapJs[] = R"JS((function () {
  'use strict';
  const native = window.__shellNative;
  delete window.__shellNative;
  if (!native || window.__shell) return;
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const parse = (s) => {
    if (s === undefined || s === '') return undefined;
    try { return JSON.parse(s); } catch (e) { return undefined; }
  };
  // Point d'entrée natif → page (réponses et évènements).
  native.register(function (kind, a, b, c, d) {
    if (kind === 'reply') {
      const p = pending.get(a);
      if (!p) return;
      pending.delete(a);
      if (b) { p.resolve(parse(c)); return; }
      const err = new Error(d || c || 'shell error');
      err.code = c;
      p.reject(err);
    } else if (kind === 'event') {
      const set = listeners.get(a);
      if (!set) return;
      const payload = parse(b);
      for (const cb of Array.from(set)) {
        try { cb(payload); } catch (e) { console.error('[__shell] écouteur', a, e); }
      }
    }
  });
  const shell = {
    invoke(channel, payload) {
      return new Promise((resolve, reject) => {
        let json;
        try { json = JSON.stringify(payload === undefined ? null : payload); }
        catch (e) { reject(e); return; }
        const id = nextId++;
        pending.set(id, { resolve, reject });
        native.send(id, String(channel), json);
      });
    },
    on(event, cb) {
      if (typeof cb !== 'function') throw new TypeError('__shell.on : fonction attendue');
      let set = listeners.get(event);
      if (!set) { set = new Set(); listeners.set(event, set); }
      set.add(cb);
      return () => { set.delete(cb); };
    },
  };
  Object.defineProperty(window, '__shell', {
    value: Object.freeze(shell), enumerable: false, configurable: false, writable: false,
  });
})();
)JS";

}  // namespace tentacle::renderer
