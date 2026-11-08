#!/usr/bin/env node
// Banc du socle : pilote une instance lancée avec --debug-input (DevTools sur <port>) et
// vérifie la saisie, les popups, le défilement, l'IME, le plein écran, le redimensionnement,
// la cadence de présentation et le repos. Clavier, IME, défilement et geste de redimensionnement
// sont de VRAIS NSEvent postés dans la file de l'app (AppKit → SDL3 → socle → CEF), pas des
// évènements CDP. La souris (déplacement, clics) entre au niveau SDL (SDL → socle → CEF) :
// sur macOS 26, SDL3 lit la position du vrai curseur, pas celle d'un NSEvent posté.
// Usage : node tests/socle/banc.mjs [port] [cas…]   (lancé par scripts/banc-socle.sh)
const port = process.argv[2] || '9301';
const only = process.argv.slice(3);
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
async function js(expr) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  const d = await new Promise((ok) => waiting.set(id, ok));
  if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description || 'exception');
  return d.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const native = (ev) => js(`__shell.invoke('shell.debug.native', ${JSON.stringify(ev)})`);
const stats = () => js(`__shell.invoke('shell.stats')`);
const rect = (id) => js(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,l:r.x,t:r.y,w:r.width,h:r.height}})()`);
const events = () => js('window.__events.slice()');
const mark = async () => (await events()).length;
const since = async (n) => (await events()).slice(n);
const click = async (p, extra = {}) => {
  await native({ type: 'mouse', kind: 'move', x: p.x, y: p.y });
  await native({ type: 'mouse', kind: 'down', x: p.x, y: p.y, ...extra });
  await sleep(100);  // durée d'un vrai clic : un relâché immédiat referme le <select> à peine ouvert
  await native({ type: 'mouse', kind: 'up', x: p.x, y: p.y, ...extra });
  await sleep(150);
};
// keyCode = kVK (QWERTY/AZERTY indifférent pour la preuve : chars fait foi côté AppKit).
// Modificateurs : FlagsChanged avant/après, comme un vrai clavier (SDL3 en tire son état).
const modKey = { cmd: 0x37, shift: 0x38, alt: 0x3a, ctrl: 0x3b };
const key = async (keyCode, chars, mods = [], charsIgnoring) => {
  for (let i = 0; i < mods.length; i++) await native({ type: 'flags', keyCode: modKey[mods[i]], mods: mods.slice(0, i + 1) });
  await native({ type: 'key', keyCode, chars, charsIgnoring: charsIgnoring ?? chars, mods, down: true });
  await native({ type: 'key', keyCode, chars, charsIgnoring: charsIgnoring ?? chars, mods, down: false });
  for (let i = mods.length - 1; i >= 0; i--) await native({ type: 'flags', keyCode: modKey[mods[i]], mods: mods.slice(0, i) });
};

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${name} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const cases = {
  async souris() {
    const n = await mark();
    await click(await rect('ping'));
    await sleep(200);
    const ev = await since(n);
    check('clic souris (bouton → IPC)', ev.some((l) => l.startsWith('ping →')), ev.filter((l) => l.startsWith('ping')).join(' | '));
    const n2 = await mark();
    const p = await rect('lnk');
    await native({ type: 'mouse', kind: 'move', x: p.x, y: p.y });
    await native({ type: 'mouse', kind: 'down', x: p.x, y: p.y, clicks: 1 });
    await native({ type: 'mouse', kind: 'up', x: p.x, y: p.y, clicks: 1 });
    await native({ type: 'mouse', kind: 'down', x: p.x, y: p.y, clicks: 2 });
    await native({ type: 'mouse', kind: 'up', x: p.x, y: p.y, clicks: 2 });
    await sleep(200);
    check('double-clic', (await since(n2)).some((l) => l.startsWith('dblclick')), (await since(n2)).join(' | '));
    const n3 = await mark();
    await click(await rect('hole'), { button: 1 });
    check('clic droit → contextmenu, pas de menu natif', (await since(n3)).some((l) => l.startsWith('contextmenu')), (await since(n3)).join(' | '));
  },
  async curseurs() {
    const p = await rect('lnk');
    await native({ type: 'mouse', kind: 'move', x: p.x, y: p.y }); await sleep(250);
    const a = (await stats()).cursor;
    const q = await rect('txt');
    await native({ type: 'mouse', kind: 'move', x: q.x, y: q.y }); await sleep(250);
    const b = (await stats()).cursor;
    check('curseurs (lien = main CT_HAND 2, champ = I CT_IBEAM 3)', a === 2 && b === 3, { lien: a, champ: b });
  },
  async clavier() {
    await js(`document.getElementById('txt').value=''`);
    await click(await rect('txt'));
    const n = await mark();
    for (const [kc, ch] of [[0x04, 'h'], [0x13, 'é'], [0x25, 'l'], [0x25, 'l'], [0x1f, 'o']]) await key(kc, ch);
    await key(0x33, '\x7f');           // retour arrière
    await key(0x31, ' ');
    await key(0x12, '!', ['shift'], '1');
    await sleep(200);
    const v = await js(`document.getElementById('txt').value`);
    check('frappe (dont é, retour arrière, Maj)', v === 'héll !', JSON.stringify(v));
    const kd = (await since(n)).filter((l) => l.startsWith('keydown')).slice(0, 2);
    check('keydown : key/code DOM', kd.length > 0 && kd[0].includes('"code":"KeyH"'), kd.join(' | '));
    const n2 = await mark();
    await key(0x28, 'k', ['cmd']);
    await sleep(150);
    check('raccourci Cmd+K vu par la page', (await since(n2)).some((l) => l.includes('"key":"k"') && l.includes('"meta":true')), (await since(n2)).join(' | '));
  },
  async copiercoller() {
    await js(`document.getElementById('txt').value='presse-papiers'`);
    await click(await rect('txt'));
    await key(0x00, 'a', ['cmd']);
    await key(0x08, 'c', ['cmd']);
    await sleep(200);
    await key(0x7c, '');         // flèche droite : fin du texte
    await key(0x09, 'v', ['cmd']);
    await sleep(300);
    const v = await js(`document.getElementById('txt').value`);
    check('Cmd+A / Cmd+C / Cmd+V', v === 'presse-papierspresse-papiers', JSON.stringify(v));
  },
  async ime() {
    await js(`document.getElementById('txt').value=''`);
    await click(await rect('txt'));
    const n = await mark();
    await native({ type: 'ime', marked: 'にほ' });
    await native({ type: 'ime', marked: 'にほん' });
    await sleep(200);
    const during = await js(`document.getElementById('txt').value`);
    const r = await native({ type: 'ime', marked: 'にほん', rect: true });
    await native({ type: 'ime', insert: '日本' });
    await sleep(200);
    const v = await js(`document.getElementById('txt').value`);
    const ev = (await since(n)).filter((l) => l.startsWith('composition'));
    const t = await rect('txt');
    check('IME : composition puis validation', during === 'にほん' && v === '日本' && ev.some((l) => l.startsWith('compositionend')), { pendant: during, apres: v, ev });
    const [rx, ry] = String(r).split(',').map(Number);
    check('IME : fenêtre de candidats au droit du champ', rx >= t.l && rx <= t.l + t.w + 4 && Math.abs(ry - t.t) < 40, { rectIme: r, champ: t });
  },
  async defilement() {
    const p = await rect('scroller');
    await js(`document.getElementById('scroller').scrollTop=0`);
    await native({ type: 'scroll', x: p.x, y: p.y, dy: -120, precise: true });
    await sleep(400);
    const a = await js(`document.getElementById('scroller').scrollTop`);
    await native({ type: 'scroll', x: p.x, y: p.y, dy: -3, precise: false });
    await sleep(400);
    const b = await js(`document.getElementById('scroller').scrollTop`);
    check('défilement précis (trackpad, 120 px)', Math.abs(a - 120) <= 2, { scrollTop: a });
    check('défilement à crans (3 crans = 120 px)', Math.abs(b - a - 120) <= 2, { scrollTop: b });
    // Limite connue : SendMouseWheelEvent n'a pas de phase, Chromium garde le geste « accroché »
    // ~0,5 s ; un <select> ouvert pendant ce temps se referme aussitôt (mesuré : échec à 0,4 s,
    // réussite à 1,5 s). On laisse le geste se terminer avant le cas suivant.
    await sleep(1000);
  },
  async popup() {
    const s0 = await stats();
    const n = await mark();
    await click(await rect('sel'));
    await sleep(400);
    const s1 = await stats();
    await key(0x7d, '');         // flèche bas
    await key(0x24, '\r');             // entrée
    await sleep(300);
    const ev = await since(n);
    check('menu <select> : popup peinte (PET_POPUP)', s1.popupFrames > s0.popupFrames, { popupFrames: s1.popupFrames - s0.popupFrames });
    const sel = await js(`(()=>{const s=document.getElementById('sel');return s.selectedIndex+':'+s.value})()`);
    check('menu <select> : choix au clavier', ev.some((l) => l === 'select → Piste audio 2'), ev.join(' | ') + ' — sel ' + sel);
  },
  async cadence() {
    await sleep(1500);
    const s = await stats();
    const raf = await js('window.__rafFps');
    check('présentation réelle ≥ 110 Hz (presentedTime)', s.presentedFps >= 110, { presentedFps: s.presentedFps, intervalleMoyenMs: s.presentIntervalMeanMs?.toFixed(2), intervalleMaxMs: s.presentIntervalMaxMs?.toFixed(2), rafFps: raf?.toFixed(1), ecranHz: s.refreshRate });
  },
  async dpi() {
    const s = await stats();
    const dpr = await js('devicePixelRatio');
    const inside = await js(`__shell.invoke('shell.debug.webPixel',{x:${s.width * s.scale - 1},y:${s.height * s.scale - 1}}).then(()=>true,()=>false)`);
    const outside = await js(`__shell.invoke('shell.debug.webPixel',{x:${s.width * s.scale},y:0}).then(()=>true,()=>false)`);
    check('Retina : image CEF = taille × échelle', dpr === s.scale && inside && !outside, { dpr, scale: s.scale, image: `${s.width * s.scale}×${s.height * s.scale}` });
  },
  async pleinecran() {
    const n = await mark();
    await js(`__shell.invoke('shell.window.setFullscreen',{on:true})`);
    await sleep(2500);
    const on = await js(`__shell.invoke('shell.window.state')`);
    const s1 = await stats();
    await js(`__shell.invoke('shell.window.setFullscreen',{on:false})`);
    await sleep(2500);
    const off = await js(`__shell.invoke('shell.window.state')`);
    const evs = (await since(n)).filter((l) => l.startsWith('évènement shell.window'));
    check('plein écran natif : entrée', on.fullscreen && on.width > 1280, { on, imageCef: s1.viewSizeChanges });
    check('plein écran natif : sortie + évènements', !off.fullscreen && off.width === 1280 && evs.some((l) => l.includes('"fullscreen":true')), { off, evenements: evs.length });
  },
  async redimension() {
    const st = await js(`__shell.invoke('shell.window.state')`);
    const s0 = await stats();
    const x0 = st.width - 2, y0 = st.height - 2;
    await native({ type: 'mouse', kind: 'move', x: x0, y: y0, via: 'appkit' });
    await native({ type: 'mouse', kind: 'down', x: x0, y: y0, via: 'appkit' });
    for (let i = 1; i <= 40; i++) await native({ type: 'mouse', kind: 'drag', x: x0 - i * 8, y: y0 - i * 5, delayMs: i * 16, via: 'appkit' });
    await native({ type: 'mouse', kind: 'up', x: x0 - 320, y: y0 - 200, delayMs: 41 * 16, via: 'appkit' });
    await sleep(1500);
    const s1 = await stats();
    const after = await js(`__shell.invoke('shell.window.state')`);
    check('redimensionnement en direct : la page suit pendant le geste', s1.liveResizeFrames > s0.liveResizeFrames && s1.viewSizeChanges - s0.viewSizeChanges >= 5, { tailles: s1.viewSizeChanges - s0.viewSizeChanges, imagesPendantGeste: s1.liveResizeFrames - s0.liveResizeFrames, avant: `${st.width}×${st.height}`, apres: `${after.width}×${after.height}` });
    const px = await js(`__shell.invoke('shell.debug.webPixel',{x:${after.width * 2 - 1},y:${after.height * 2 - 1}}).then(()=>'ok',()=>'hors image')`);
    check('après redimensionnement : image à la nouvelle taille', px === 'ok' && after.width < st.width, px);
  },
};
for (const [name, fn] of Object.entries(cases)) {
  if (only.length && !only.includes(name)) continue;
  try { await fn(); } catch (e) { check(name, false, String(e)); }
}
ws.close();
const ko = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - ko}/${results.length} OK`);
process.exit(ko ? 1 : 0);
