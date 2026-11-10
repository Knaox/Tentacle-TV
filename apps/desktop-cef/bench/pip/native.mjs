// Banc du chemin NATIF du PiP : évènements AppKit postés dans la fenêtre PiP (`pip.debug.native`,
// option --debug-input) → TentaclePipView → page du PiP ; niveaux et bureaux de la fenêtre selon
// le mode ; le PiP ancré suit la fenêtre principale (`pip.debug.moveHost`).
//   PONT_CDP_PORT=9426 node bench/pip/native.mjs ["Banc Pistes SDR"]
import { drive, findItem, sleep } from "./pip-drive.mjs";

const d = await drive();
const { check, cdp } = d;
const native = (ev) => cdp.eval(`__shell.invoke('pip.debug.native', ${JSON.stringify(ev)})`);
const settle = async () => {
  let last = "";
  for (let i = 0; i < 30; i++) {
    const s = await d.state();
    if (JSON.stringify(s?.bounds) === last) return s;
    last = JSON.stringify(s?.bounds);
    await sleep(120);
  }
  return d.state();
};

await cdp.eval("localStorage.removeItem('tentacle_pip_video_width')");
await d.playFromDetail((await findItem(process.argv[2] ?? "Banc Pistes SDR")).item.Id);
await sleep(1500);
await d.dismissModals();
await d.waitFor(async () => (await d.prop("time-pos")) > 1, 15000);
await d.wake(); await sleep(250);
await cdp.eval(`[...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === "Lecture en incrustation")?.click()`);
await d.waitFor(async () => (await d.state())?.open, 6000);
const pip = await d.pip();
let s = await settle();

// Ancré, application inactive (lancée en arrière-plan) : niveau normal, un seul bureau.
check("ancré, application inactive : niveau normal, pas sur tous les bureaux", /level=0 /.test(s.window) && /allSpaces=0/.test(s.window), s.window);
check("fenêtre : transparente, sans ombre, redimensionnable, titre du mode", /opaque=0 shadow=0 resizable=1 title=Tentacle TV · Mini player/.test(s.window), s.window);

console.log("   ℹ︎ page du PiP :", JSON.stringify(await pip.eval("({ w: innerWidth, h: innerHeight, url: location.href, n: document.querySelectorAll('button').length })")));
// Le survol arrive par AppKit.
await pip.eval("window.__moves = 0; document.addEventListener('mousemove', () => window.__moves++), true");
for (const [x, y] of [[60, 60], [80, 70], [100, 80]]) console.log("   ℹ︎ injection :", await native({ kind: "move", x, y }).catch((e) => e.message));
await sleep(200);
const moves = await pip.eval("window.__moves");
// Chromium regroupe les mouvements d'une même image : au moins un arrive, jamais zéro.
check("survol natif → page du PiP", moves >= 1, `${moves} mousemove pour 3 envoyés`);

// Un clic natif sur « Pause » (le premier clic d'une fenêtre inactive va au bouton).
const rect = await pip.eval(`(() => { const b = [...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === "Pause");
  if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
if (rect) {
  await native({ kind: "move", ...rect });
  await native({ kind: "down", ...rect });
  await native({ kind: "up", ...rect });
}
const paused = await d.waitFor(async () => (await d.prop("pause", "flag")) === true, 3000);
check("clic natif sur « Pause » : la lecture s'arrête", rect && paused, JSON.stringify(rect));

// La molette native agrandit le PiP.
const before = (await settle()).bounds;
for (let i = 0; i < 3; i++) { await native({ kind: "scroll", x: 120, y: 90, dy: 10 }); await sleep(60); }
s = await settle();
check("molette native : le PiP grandit", s.bounds[2] > before[2], `${before} → ${s.bounds}`);

// Ancré, il suit la fenêtre principale.
const host0 = s.host, pip0 = s.bounds;
await cdp.eval("__shell.invoke('pip.debug.moveHost', { dx: 40, dy: 30 })");
await sleep(400);
s = await d.state();
check("ancré : suit la fenêtre principale", s.bounds[0] - pip0[0] === s.host[0] - host0[0] && s.bounds[1] - pip0[1] === s.host[1] - host0[1] && s.host[0] !== host0[0],
  `application ${host0} → ${s.host} · PiP ${pip0} → ${s.bounds}`);
await cdp.eval("__shell.invoke('pip.debug.moveHost', { dx: -40, dy: -30 })");

// Flottant : au-dessus des fenêtres, sur tous les bureaux, plein écran compris.
await pip.move(100, 80);
await pip.click("Détacher sur le bureau");
await sleep(400);
s = await d.state();
check("flottant : niveau « floating », tous les bureaux, plein écran", /level=3 /.test(s.window) && /allSpaces=1 fullScreenAux=1/.test(s.window) && /Picture-in-Picture/.test(s.window), s.window);

await pip.click("Fermer la vidéo");
await d.waitFor(async () => !(await d.state()).open, 5000);
pip.close();
d.finish();
