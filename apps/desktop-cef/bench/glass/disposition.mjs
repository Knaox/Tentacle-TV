// Banc de DISPOSITION du lecteur (lot rf2) : le lecteur en verre garde la disposition du
// lecteur sans verre — « la même disposition, avec des composants Liquid Glass ». Mesure, par
// CDP, le rectangle de chaque commande, de chaque groupe et de chaque menu, verre COUPÉ puis
// verre ALLUMÉ, et les compare au demi-pixel ; relit enfin les vues de verre d'AppKit
// (`liquidGlass.debug.snapshot`) : une par forme, au rectangle de sa forme.
//
//   PONT_CDP_PORT=9414 node bench/glass/disposition.mjs
//
// L'app : CEF sur macOS 26 (Apple Silicon), lancée avec --mute --background, un build
// instrumenté (`TENTACLE_DEBUG=1` ou Vite), le lecteur OUVERT sur un épisode (les boutons
// d'épisode précédent / suivant et « Épisodes » n'existent que là) et EN PAUSE. Rien que des
// nombres : le verre natif ne se capture pas par CDP. Code de sortie 1 au premier écart.
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);

/** La souris bouge au centre de la page : les commandes du lecteur paraissent. */
async function wake() {
  const { w, h } = await cdp.eval("({ w: innerWidth, h: innerHeight })");
  for (const dx of [0, 14, 0]) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: w / 2 + dx, y: h / 2 });
  await sleep(900);
}

async function setGlass(on) {
  await cdp.eval(`window.__tentaclePlayerGlass.setLiquidGlass(${on})`);
  await sleep(1200);
  await wake();
}

/** Rectangles des commandes, des groupes et des textes — quel que soit l'habillage. */
const MEASURE = `(() => {
  const root = document.querySelector(".pl-chrome, .lgp-chrome");
  if (!root) return null;
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 2) / 2).join(" "); };
  const out = { chrome: root.className.split(" ")[0], controls: [], groups: [] };
  for (const el of root.querySelectorAll("button, input[type=range]")) {
    if (el.closest(".pl-panel, .lgp-panel")) continue;
    const shown = getComputedStyle(el).display !== "none";
    // Lire / pause et le son changent de nom avec l'état : on les nomme par leur rôle.
    const label = el.getAttribute("aria-label") ?? "";
    out.controls.push([label, shown ? r(el) : "masqué"]);
  }
  out.controls.push(["titre", r(root.querySelector(".pl-title, .lgp-title"))]);
  out.controls.push(["sous-titre", r(root.querySelector(".pl-subtitle, .lgp-subtitle"))]);
  out.controls.push(["barre (zone)", r(root.querySelector(".pl-seek, .lgp-scrub__zone"))]);
  out.controls.push(["barre (trait)", r(root.querySelector(".pl-seek__rail, .lgp-scrub__rail"))]);
  const time = root.querySelector(".pl-time, .lgp-time--row");
  out.controls.push(["temps", time ? r(time) + " « " + time.textContent.replace(/\\d/g, "0") + " »" : null]);
  for (const g of root.querySelectorAll(".pl-btn--solo, .pl-caps, .lgp-orb, .lgp-caps")) out.groups.push(r(g) + " r=" + parseFloat(getComputedStyle(g).borderTopLeftRadius) + " (" + (g.matches("button") ? 1 : g.querySelectorAll("button").length) + " boutons)");
  return out;
})()`;

/** Ouvre un menu par son bouton, le mesure, le referme. */
const menu = (label) => `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = document.querySelector(".pl-chrome, .lgp-chrome");
  const button = root?.querySelector('button[aria-label="${label}"]');
  if (!button) return "absent";
  button.click(); await wait(1100);
  const panel = document.querySelector(".pl-panel, .lgp-panel");
  const r = (el) => { if (!el) return "—"; const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 2) / 2).join(" "); };
  const res = panel ? { boîte: r(panel), "première ligne": r(panel.querySelector(".pl-option, .lgp-option")), croix: r(panel.querySelector("button[aria-label]")), titre: panel.querySelector(".pl-panel__title")?.textContent ?? "—", boutons: panel.querySelectorAll("button").length } : "aucun panneau";
  button.click(); await wait(600);
  return res;
})()`;

/** Le curseur du volume, pointeur posé sur le bouton du son : sa place, et la capsule élargie. */
async function volumeReveal() {
  const at = await cdp.eval(`(() => { const b = document.querySelector(".pl-volume button, .lgp-volume button")?.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; })()`);
  if (at === null) return "absent";
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
  await sleep(500);
  const res = await cdp.eval(`(() => {
    const r = (el) => { if (!el) return "—"; const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 2) / 2).join(" "); };
    const range = document.querySelector(".pl-volume__range, .lgp-range");
    return { curseur: getComputedStyle(range).display === "none" ? "masqué" : r(range), capsule: r(range.closest(".pl-caps, .lgp-caps")) };
  })()`);
  await wake();
  return res;
}

let failures = 0;
function compare(name, a, b) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) failures += 1;
  console.log(`${same ? "✅" : "❌"} ${String(name).padEnd(26)} ${JSON.stringify(a)}${same ? "" : `  ≠  ${JSON.stringify(b)}`}`);
}

if (!(await cdp.eval("typeof window.__tentaclePlayerGlass === 'object'"))) {
  console.error("build non instrumenté : window.__tentaclePlayerGlass absent (TENTACLE_DEBUG=1)");
  process.exit(2);
}

const MENUS = ["Paramètres", "Vitesse de lecture", "Épisodes"];
const shots = {};
for (const on of [false, true]) {
  await setGlass(on);
  const layout = await cdp.eval(MEASURE);
  if (layout === null) { console.error("le lecteur n'est pas ouvert"); process.exit(2); }
  const menus = {};
  for (const label of MENUS) { await wake(); menus[label] = await cdp.eval(menu(label)); }
  const volume = await volumeReveal();
  shots[on ? "verre" : "sans"] = { layout, menus, volume };
}
const { sans, verre } = shots;
console.log(`habillages : ${sans.layout.chrome} (verre coupé) · ${verre.layout.chrome} (verre allumé) — rectangles « x y largeur hauteur »\n`);

console.log("— commandes, dans l'ordre du document");
const STATEFUL = /^(Lecture|Pause|Couper le son|Rétablir le son|Play|Mute|Unmute)$/;
const named = (controls) => controls.map(([label, rect]) => [STATEFUL.test(label) ? label.replace(/^(Lecture|Pause|Play)$/, "lire / pause").replace(/^(Couper le son|Rétablir le son|Mute|Unmute)$/, "son") : label, rect]);
const a = named(sans.layout.controls);
const b = named(verre.layout.controls);
compare("nombre de commandes", a.length, b.length);
for (let i = 0; i < Math.max(a.length, b.length); i++) compare(a[i]?.[0] ?? b[i]?.[0], a[i], b[i]);

console.log("\n— groupes (la sortie, la capsule du transport, la capsule du son et des réglages)");
compare("nombre de groupes", sans.layout.groups.length, verre.layout.groups.length);
sans.layout.groups.forEach((g, i) => compare(`groupe ${i + 1}`, g, verre.layout.groups[i]));

console.log("\n— volume survolé");
compare("curseur et capsule", sans.volume, verre.volume);

console.log("\n— menus");
for (const label of MENUS) compare(label, sans.menus[label], verre.menus[label]);

// Les vues de verre d'AppKit : une par forme, au rectangle de sa forme.
await wake();
const forms = await cdp.eval(`[...document.querySelectorAll(".lgp-orb, .lgp-caps")].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(" "); })`);
const snapshot = await cdp.eval("__shell.invoke('liquidGlass.debug.snapshot')").catch(() => null);
console.log("\n— verre natif (AppKit)");
if (snapshot === null) {
  console.log("   instantané indisponible (`liquidGlass.debug.snapshot`) : non vérifié");
} else {
  const native = snapshot.regions.filter((r) => !r.hidden).map((r) => [r.css.x, r.css.y, r.css.width, r.css.height].map(Math.round).join(" "));
  compare("formes ↔ vues natives", [...forms].sort(), [...native].sort());
  for (const r of snapshot.regions) console.log(`   ${r.level} css=${Math.round(r.css.x)},${Math.round(r.css.y)} ${Math.round(r.css.width)}×${Math.round(r.css.height)} r=${r.css.radius} → AppKit ${r.frame ? `${Math.round(r.frame.x)},${Math.round(r.frame.y)} ${Math.round(r.frame.width)}×${Math.round(r.frame.height)}` : "—"}`);
}

console.log(failures === 0 ? "\n✅ même disposition, verre coupé et verre allumé" : `\n❌ ${failures} écart(s)`);
cdp.close();
process.exit(failures === 0 ? 0 : 1);
