// Outils du banc de saisie : DevTools (CDP) et évènements NATIFS postés dans l'app lancée avec
// --debug-input (NSEvent → AppKit → SDL3 → socle → CEF → page), jamais des évènements CDP.
export async function connect(port) {
  const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let seq = 0;
  const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
  const send = async (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok) => waiting.set(id, ok));
  };
  const js = async (expr) => {
    const d = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description || 'exception');
    return d.result?.result?.value;
  };
  return { js, send, close: () => ws.close() };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// kVK_* (HIToolbox/Events.h) et caractères AppKit des touches non imprimables.
export const K = {
  return: [0x24, '\r'], kpEnter: [0x4c, '\x03'], tab: [0x30, '\t'], esc: [0x35, '\x1b'],
  left: [0x7b, ''], right: [0x7c, ''], down: [0x7d, ''], up: [0x7e, ''],
  space: [0x31, ' '], backspace: [0x33, '\x7f'], del: [0x75, ''],
  home: [0x73, ''], end: [0x77, ''], pgup: [0x74, ''], pgdn: [0x79, ''],
  f1: [0x7a, ''], f2: [0x78, ''], f3: [0x63, ''], f4: [0x76, ''],
  f5: [0x60, ''], f6: [0x61, ''], f7: [0x62, ''], f8: [0x64, ''],
  f9: [0x65, ''], f10: [0x6d, ''], f11: [0x67, ''], f12: [0x6f, ''],
};
// Touches imprimables : position physique (kVK ANSI) ; les caractères viennent de la
// disposition active du Mac (layoutChars côté app), comme avec le vrai clavier.
export const P = { a: 0x00, s: 0x01, f: 0x03, h: 0x04, z: 0x06, x: 0x07, c: 0x08, v: 0x09, q: 0x0c,
  w: 0x0d, e: 0x0e, k: 0x28, m: 0x2e, comma: 0x2b, n1: 0x12, n0: 0x1d, minus: 0x1b, equal: 0x18,
  semicolon: 0x29, bracketR: 0x1e };
const MOD_KEY = { cmd: 0x37, shift: 0x38, alt: 0x3a, ctrl: 0x3b };

export function keyboard(js) {
  const native = (ev) => js(`__shell.invoke('shell.debug.native', ${JSON.stringify(ev)})`);
  // Un appui complet : FlagsChanged des modificateurs (SDL3 en tire son état), keyDown, keyUp.
  // spec = [kVK, chars?] (touche de K) ou kVK seul (caractères de la disposition).
  const press = async (spec, mods = [], opts = {}) => {
    const [keyCode, chars] = Array.isArray(spec) ? spec : [spec, undefined];
    const base = { type: 'key', keyCode, mods };
    if (chars !== undefined) Object.assign(base, { chars: opts.chars ?? chars, charsIgnoring: opts.charsIgnoring ?? chars });
    for (let i = 0; i < mods.length; i++) await native({ type: 'flags', keyCode: MOD_KEY[mods[i]], mods: mods.slice(0, i + 1) });
    await native({ ...base, down: true });
    for (let r = 0; r < (opts.repeats ?? 0); r++) await native({ ...base, down: true, repeat: true });
    if (!opts.holdUp) await native({ ...base, down: false });
    for (let i = mods.length - 1; i >= 0; i--) await native({ type: 'flags', keyCode: MOD_KEY[mods[i]], mods: mods.slice(0, i) });
    await sleep(opts.wait ?? 120);
  };
  return { native, press };
}

// Clic par la file SDL (socle : la position d'un NSEvent posté est ignorée par SDL3 sur macOS 26).
export async function clickOn(js, native, selector) {
  const r = await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await native({ type: 'mouse', kind: 'move', x: r.x, y: r.y });
  await native({ type: 'mouse', kind: 'down', x: r.x, y: r.y });
  await sleep(80);
  await native({ type: 'mouse', kind: 'up', x: r.x, y: r.y });
  await sleep(120);
}

// Résumé lisible d'un évènement noté par la page : "keydown Enter/Enter/13".
export const fmt = (e) => `${e.t} ${JSON.stringify(e.key)}/${e.code}/${e.keyCode}` +
  (e.t === 'keypress' ? `/c${e.charCode}` : '') +
  ['alt', 'ctrl', 'meta', 'shift'].filter((m) => e[m]).map((m) => '+' + m).join('') + (e.repeat ? ' R' : '');
