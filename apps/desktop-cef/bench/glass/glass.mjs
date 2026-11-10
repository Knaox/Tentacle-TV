// Banc du verre natif (Liquid Glass, macOS 26) de Tentacle CEF, DANS le front de Tentacle :
// réglage, lecture du banc, verre posé sur le lecteur (instantané relu dans AppKit), tons
// mesurés (`liquidGlass.sample`), verre retiré à la sortie. Rien que des nombres — sauf, sur
// demande, UNE capture de la seule fenêtre de l'app (`screencapture -l`, jamais l'écran) :
//   PONT_CDP_PORT=9429 [GLASS_WINDOW=<CGWindowID> GLASS_CAPTURE=<fichier.png>] \
//     node bench/glass/glass.mjs ["Banc Pistes SDR"]
// L'app : lancée avec --mute --background (profil à soi), le compte de test déjà connecté.
import { execFileSync } from "node:child_process";
import { findItem, sleep } from "../../web/shim/dev/drive.mjs";
import { drive } from "../pip/pip-drive.mjs";

const title = process.argv[2] ?? "Banc Pistes SDR";
const d = await drive();
const { check, cdp } = d;
const snapshot = () => cdp.eval("__shell.invoke('liquidGlass.debug.snapshot')");
const sample = (rects) => cdp.eval(`window.tentacle.liquidGlass.sample(${JSON.stringify(rects)})`);
const fmt = (values) => values.map((v) => (v === null ? "null" : v.toFixed(3))).join(", ");
/** La souris bouge au centre de la page : les contrôles du lecteur paraissent. */
const wiggle = async () => {
  const { w, h } = await cdp.eval("({ w: innerWidth, h: innerHeight })");
  for (const dx of [0, 12, 0]) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: w / 2 + dx, y: h / 2 });
};

// 1. Le pont et le réglage.
const bridge = await cdp.eval("({ present: !!window.tentacle.liquidGlass, refracts: window.tentacle.liquidGlass?.refractsVideo, mode: document.documentElement.getAttribute('data-liquid-glass') })");
check("pont du verre présent (macOS 26)", bridge.present, JSON.stringify(bridge));
if (bridge.mode !== "native") {
  await cdp.eval("localStorage.setItem('tentacle_liquid_glass', 'true')");
  check("réglage allumé par le stockage de l'appareil", true, "tentacle_liquid_glass=true (rechargement)");
}
const idle = await snapshot();
check("hors lecture : aucune vue native", idle.nativeViews === 0 && !idle.root, `enabled=${idle.enabled} root=${idle.root} vues=${idle.nativeViews}`);

// 2. Une lecture du banc, contrôles affichés.
await d.playFromDetail((await findItem(title)).item.Id);
const playing = async () => { const a = await d.prop("time-pos"); await sleep(900); const b = await d.prop("time-pos"); return b > a ? [a, b] : null; };
check("lecture", await d.waitFor(() => playing(), 15000), title);
await sleep(3500);  // les contrôles de l'ouverture s'effacent : l'entrée qui suit est mesurée
await wiggle();
// La matérialisation (lot lg8), relue dans la couche de PRÉSENTATION d'AppKit : chaque conteneur
// s'allume (opacité en vol entre 0 et 1) pendant que son verre monte vers son cadre.
const alphas = [];
for (const end = Date.now() + 700; Date.now() < end; await sleep(25)) {
  for (const r of (await snapshot()).regions) if (r.live) alphas.push(r.live.containerAlpha);
}
const inFlight = alphas.filter((a) => a > 0.02 && a < 0.98).length;
check("matérialisation : les conteneurs s'allument en fondu (animateur d'AppKit)", inFlight > 0,
  `${inFlight} relevés en vol sur ${alphas.length} (min ${Math.min(...alphas).toFixed(2)})`);
await sleep(500);
const shown = await snapshot();
const surface = await d.surface();
console.log(`   couche vidéo : ${surface?.colorspace ?? "?"} ${surface?.pixelFormat ?? ""} EDR=${surface?.wantsEdr ?? "?"}`
  + ` — video-target-params ${JSON.stringify(await d.prop("video-target-params/gamma", "string"))}`);
check("lecteur : verre posé, surface transparente", shown.root && shown.surfaceVisible && shown.nativeViews > 0,
  `vues=${shown.nativeViews} groupes=${shown.groups} régions=${shown.regions.length} surface=${shown.surfaceVisible}`);
for (const r of shown.regions) {
  console.log(`   ${r.id.padEnd(22)} ${r.level.padEnd(8)} css=${Math.round(r.css.x)},${Math.round(r.css.y)} ${Math.round(r.css.width)}×${Math.round(r.css.height)} r=${r.css.radius}`
    + ` → AppKit ${r.frame ? `${Math.round(r.frame.x)},${Math.round(r.frame.y)} ${Math.round(r.frame.width)}×${Math.round(r.frame.height)}` : "—"} style=${r.style} caché=${r.hidden}`);
}
const { w, h } = await cdp.eval("({ w: innerWidth, h: innerHeight })");
if (process.env.GLASS_WINDOW && process.env.GLASS_CAPTURE) {
  await wiggle();
  execFileSync("/usr/sbin/screencapture", ["-x", "-o", `-l${process.env.GLASS_WINDOW}`, process.env.GLASS_CAPTURE]);
  console.log(`   capture de la fenêtre ${process.env.GLASS_WINDOW} : ${process.env.GLASS_CAPTURE}`);
}
const layers = await d.layers();
const glassLine = String(layers).split("\n").findIndex((l) => / z=5 /.test(l));
check("la racine du verre est ENTRE la vidéo (z 0) et la page (z 10)", glassLine > 0, `ligne ${glassLine} de l'arbre de couches`);

// 3. Les tons : la page (et la vidéo là où elle est transparente), puis la vidéo seule.
const capsule = shown.regions[0]?.css ?? { x: w / 2 - 100, y: h - 90, width: 200, height: 56 };
const rects = [
  { x: 0, y: 0, width: w, height: h / 4 },
  { x: 0, y: h - h / 4, width: w, height: h / 4 },
  { x: capsule.x, y: capsule.y, width: capsule.width, height: capsule.height, under: "window" },
];
const t0 = Date.now();
const tones = await sample(rects);
check("sample : la page sur la vidéo, puis la vidéo seule", Array.isArray(tones) && tones.length === 3 && tones.some((v) => v !== null),
  `[${fmt(tones)}] en ${Date.now() - t0} ms`);
const t1 = Date.now();
const again = await sample([rects[2]]);
check("sample vidéo : une capture par seconde au plus", Date.now() - t1 >= 600, `[${fmt(again)}] en ${Date.now() - t1} ms`);

// 4. Contrôles masqués : plus une vue native (`contrôles masqués = 0 région native`).
await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: w - 2, y: h / 2 });
const hidden = await d.waitFor(async () => (await snapshot()).nativeViews === 0, 9000);
const afterHide = await snapshot();
check("contrôles masqués : 0 vue native", hidden, `vues=${afterHide.nativeViews} sortants=${afterHide.leaving.length}`);

// 5. Sortie du lecteur : surface opaque, rien de posé.
await cdp.eval("history.back()");
await d.waitFor(async () => !(await d.path()).startsWith("/watch/"), 8000);
const out = await d.waitFor(async () => { const s = await snapshot(); return !s.root && !s.surfaceVisible ? s : null; }, 8000);
check("sortie : verre retiré, surface opaque", !!out, JSON.stringify(out ?? await snapshot()).slice(0, 160));
const freed = await d.waitFor(async () => (await snapshot()).liveViews === 0, 4000);
const layersAfter = String(await d.layers());
check("aucune fuite : 0 vue du verre vivante, plus de couche z 5", freed && !/ z=5 /.test(layersAfter),
  `vues vivantes ${(await snapshot()).liveViews}`);

const failed = d.results.filter((r) => !r.ok).length;
console.log(`\n${d.results.length - failed}/${d.results.length} vérifications`);
process.exit(failed ? 1 : 0);
