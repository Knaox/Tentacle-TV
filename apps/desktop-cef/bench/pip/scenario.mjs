// Banc du PiP de Tentacle CEF, DANS le front de Tentacle, par ses propres boutons et gestes.
// La souris va au navigateur du PiP par CDP ; le curseur que suivent les gestes natifs est
// remplacé (`pip.debug.cursor`, option --debug-input) : jamais le vrai curseur de l'écran.
//   PONT_CDP_PORT=9426 node bench/pip/scenario.mjs ["Banc HDR10 Pistes"] ["Banc Pistes SDR"]
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { drive, findItem, sleep } from "./pip-drive.mjs";

const hdrTitle = process.argv[2] ?? "Banc HDR10 Pistes";
const otherTitle = process.argv[3] ?? "Banc Pistes SDR";
const d = await drive();
const { check, cdp } = d;
const SHADOW = 4, MARGIN = 20;  // macOS : `pipFrame.ts`, `PIP_MARGIN`
const L = { reduce: "Lecture en incrustation", expand: "Revenir au lecteur", close: "Fermer la vidéo",
  dock: "Ranger dans l'application", undock: "Détacher sur le bureau" };

const edr = () => {
  const out = execFileSync(`${homedir()}/.cache/tentacle-cef/build/video-hdr/edr-probe/edr-probe`, ["--duration", "1", "--changes"]).toString();
  return Number(/max=([\d.]+)/.exec(out)?.[1]);
};
const settle = async () => {  // la fenêtre PiP ne bouge plus (animation finie)
  let last = "";
  for (let i = 0; i < 30; i++) {
    const s = await d.state();
    const now = JSON.stringify(s?.bounds);
    if (now === last) return s;
    last = now;
    await sleep(120);
  }
  return d.state();
};
const playing = async () => { const a = await d.prop("time-pos"); await sleep(1200); const b = await d.prop("time-pos"); return b > a ? [a, b] : null; };
const reduce = async () => {
  await d.wake(); await sleep(250);
  await cdp.eval(`[...document.querySelectorAll("button")].find((e) => e.getAttribute("aria-label") === ${JSON.stringify(L.reduce)})?.click()`);
  await d.waitFor(async () => (await d.state())?.open && !(await d.path()).startsWith("/watch/"), 6000);
  return d.pip();
};
const atCorner = (b, area) => b && b[0] + b[2] - SHADOW === area[0] + area[2] - MARGIN && b[1] + b[3] - SHADOW === area[1] + area[3] - MARGIN;
const hasVideo = (layers) => /TentacleVideoLayer/.test(layers ?? "");

// La largeur choisie se retient d'un PiP à l'autre (`pipGeometry.ts`) : le banc part du défaut.
await cdp.eval("localStorage.removeItem('tentacle_pip_video_width')");

// 1. Réduire une lecture HDR10 : la vidéo passe dans le PiP, la lecture continue, HDR gardé.
await d.playFromDetail((await findItem(hdrTitle)).item.Id);
await sleep(1500);
await d.dismissModals();
check("lecture HDR10", await d.waitFor(() => playing(), 15000), hdrTitle);
await sleep(2500);
const before = await d.surface();
const starts = await cdp.eval("window.__probe.events.filter((e) => e.event === 'start-file').length");
let pip = await reduce();
check("PiP ouvert, page quittée", pip !== null, `chemin ${await d.path()}`);
let s = await settle();
check("vidéo prêtée à la pile du PiP", s.videoLent && hasVideo(s.layers) && !hasVideo(await d.layers()),
  (s.layers.split("\n").find((l) => l.includes("TentacleVideoLayer")) ?? "").trim());
check("ancré au coin de l'application (mode par défaut)", s.mode === "docked" && atCorner(s.bounds, s.host), `cadre ${s.bounds} · application ${s.host}`);
check("lecture continue, même instance", (await playing()) && (await cdp.eval("window.__probe.events.filter((e) => e.event === 'start-file').length")) === starts, `start-file ${starts}`);
const after = await d.surface();
check("HDR gardé (couche PQ, EDR, métadonnées)", after.colorspace === before.colorspace && /PQ/.test(after.colorspace) && after.wantsEdr && after.hasEdrMetadata,
  `${after.colorspace} ${after.pixelFormat} ${after.pixelSize}`);
// La marge EDR est celle de l'ÉCRAN (partagé avec d'autres lectures HDR sur un banc commun) :
// mesurée et dite, sans verdict — la preuve est l'état de la couche, ci-dessus.
const headroom = edr();
console.log(`   ℹ︎ marge EDR de l'écran pendant le PiP HDR10 : ${headroom}`);
const view = await pip.eval("({ w: innerWidth, h: innerHeight, vis: document.visibilityState, dpr: devicePixelRatio })");
check("page du PiP : taille de la fenêtre, visible, Retina", view.w === s.bounds[2] && view.h === s.bounds[3] && view.vis === "visible" && view.dpr === s.scale, JSON.stringify(view));

// 2. Détacher : comme la colle, vers « flottant » le PiP reste où il est (`pipShell.ts`).
const docked = s.bounds;
await pip.move(view.w / 2, view.h / 2);
check("bouton « détacher »", await pip.click(L.undock), "clic");
s = await settle();
check("flottant : reste où il est", s.mode === "floating" && s.bounds[0] + s.bounds[2] === docked[0] + docked[2] && s.bounds[1] + s.bounds[3] === docked[1] + docked[3],
  `cadre ${docked} → ${s.bounds}`);

// 3. Molette : la taille glisse, le coin bas-droit reste fixe.
const w0 = s.bounds;
for (let i = 0; i < 3; i++) { await pip.wheel(view.w / 2, view.h / 2, -100); await sleep(60); }
s = await settle();
check("molette : plus grand, coin fixe", s.bounds[2] > w0[2] && s.bounds[0] + s.bounds[2] === w0[0] + w0[2] && s.bounds[1] + s.bounds[3] === w0[1] + w0[3], `${w0} → ${s.bounds}`);

// 4. Glisser : le point saisi reste sous le curseur (curseur de banc).
let b = s.bounds;
const grab = { x: 45, y: Math.round(b[3] / 2) };
await d.cursor({ x: b[0] + grab.x, y: b[1] + grab.y });
await pip.move(grab.x, grab.y);
await pip.press(grab.x, grab.y);
await pip.move(grab.x + 12, grab.y, 1);
await d.cursor({ x: 500, y: 400 });
await sleep(200);
s = await d.state();
await pip.release(grab.x + 12, grab.y);
check("glisser : le PiP suit le curseur", s.bounds[0] === 500 - grab.x && s.bounds[1] === 400 - grab.y, `cadre ${s.bounds}`);

// 5. Tirer le coin bas-droit : le haut-gauche reste fixe, le ratio est gardé.
b = (await settle()).bounds;
const cx = b[2] - 6, cy = b[3] - 6;
await d.cursor({ x: b[0] + cx, y: b[1] + cy });
await pip.move(cx, cy);
await pip.press(cx, cy);
await d.cursor({ x: b[0] + cx + 120, y: b[1] + cy + 68 });
await sleep(200);
s = await d.state();
await pip.release(cx, cy);
await d.cursor(null);
const ratio = (x) => (x[2] - 16) / (x[3] - 16);
check("coin tiré : plus grand, coin opposé fixe, ratio gardé", s.bounds[2] > b[2] && s.bounds[0] === b[0] && s.bounds[1] === b[1] && Math.abs(ratio(s.bounds) - ratio(b)) < 0.02,
  `${b} → ${s.bounds}`);

// 6. Ranger : retour au coin de l'application.
check("bouton « ranger »", await pip.click(L.dock), "clic");
s = await settle();
check("ancré : au coin de l'application", s.mode === "docked" && atCorner(s.bounds, s.host), `cadre ${s.bounds}`);

// 7. Survie à la navigation : on parcourt l'application, le PiP reste et joue.
await cdp.eval("history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate'))");
await sleep(1200);
check("navigation : PiP ouvert, lecture continue", (await d.state()).open && (await playing()), `chemin ${await d.path()}`);

// 8. Une autre lecture lancée pendant le PiP s'y joue ; la page reste celle qu'on parcourait.
const other = (await findItem(otherTitle)).item;
await cdp.eval(`location.pathname`);
await cdp.eval(`history.pushState({}, '', '/media/${other.Id}'); dispatchEvent(new PopStateEvent('popstate'))`);
await sleep(2500);
await d.dismissModals();
await d.clickText("Lecture");
await sleep(3500);
s = await d.state();
const title = await d.prop("media-title", "string");
check("lecture lancée pendant le PiP : jouée DANS le PiP", s.open && hasVideo(s.layers) && !(await d.path()).startsWith("/watch/") && (await playing()),
  `chemin ${await d.path()} · titre ${title}`);

// 9. Revenir au lecteur : l'image regagne sa place, le PiP se ferme, la vidéo revient.
pip.close();
pip = await d.pip();
await pip.move(100, 80);
check("bouton « revenir au lecteur »", await pip.click(L.expand), "clic");
await d.waitFor(async () => !(await d.state()).open && (await d.path()).startsWith("/watch/"), 6000);
s = await d.state();
check("retour : PiP fermé, vidéo dans la fenêtre principale", !s.open && hasVideo(await d.layers()), `chemin ${await d.path()}`);
check("retour : lecture continue", await playing(), "time-pos avance");

// 10. Double-clic sur l'image du PiP : retour au lecteur.
pip = await reduce();
s = await settle();
await pip.move(45, s.bounds[3] / 2);
await pip.press(45, s.bounds[3] / 2, 1); await pip.release(45, s.bounds[3] / 2, 1);
await pip.press(45, s.bounds[3] / 2, 2); await pip.release(45, s.bounds[3] / 2, 2);
check("double-clic : retour au lecteur", await d.waitFor(async () => !(await d.state()).open && (await d.path()).startsWith("/watch/"), 6000), `chemin ${await d.path()}`);

// 11. Fermer la vidéo depuis le PiP : PiP et lecture s'arrêtent.
pip = await reduce();
await settle();
await pip.move(100, 80);
check("bouton « fermer »", await pip.click(L.close), "clic");
await d.waitFor(async () => !(await d.state()).open, 5000);
await sleep(800);
check("fermé : plus de PiP ni de vidéo", !(await d.state()).open && (await d.surface()) === null && !hasVideo(await d.layers()), `chemin ${await d.path()}`);
console.log(`   ℹ︎ marge EDR de l'écran après la fermeture : ${edr()}`);

pip?.close();
d.finish();
