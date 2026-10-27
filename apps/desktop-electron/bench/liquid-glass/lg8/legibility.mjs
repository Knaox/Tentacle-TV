// Banc lg8 — LISIBILITÉ du lecteur, fenêtre ACTIVE, sur neuf images fixes.
// Pilote l'app tenue par `lg2/hold.mjs` (mêmes ports), les gestes de fenêtre par
// `lg3/probe.mjs` (play, pause, show, activate, unfront). Pour chaque clip et
// chaque état (contrôles, panneaux) : deux captures de la fenêtre (avec / sans
// premier plan), puis le contraste de chaque texte, glyphe et de la barre.
//   BANC_STATE=… node lg8/legibility.mjs [Knaoxtest]
//   LG8_CLIPS=blanc,pastel  LG8_STATES=controles,vitesse,pistes  LG8_OUT=<dossier>
// Rend `rapport.md` (tableaux) et `mesures.json` dans le dossier des preuves.
// Jamais une fenêtre activée sous les doigts de Damien : 120 s d'inactivité
// avant CHAQUE activation, abandon du clip s'il revient pendant la mesure.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE, outDir } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { captureWindow, hidIdleSeconds, mainWindow, waitHidIdle } from "../lib/macos.mjs";
import { centerOf, clickAt, showControls } from "../lib/steps.mjs";
import { elementContrast, readRgb, verdict } from "./contrast.mjs";
import { report } from "./report.mjs";
import { COLLECT, SET_BARE } from "./targets.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const who = process.argv[2] ?? "Knaoxtest";
const CLIPS = { blanc: "Blanc", noir: "Noir", gris: "Gris", jaune: "Jaune", rouge: "Rouge", bleu: "Bleu", pastel: "Pastel", bruit: "Bruit", degrade: "Dégradé" };
const clips = (process.env.LG8_CLIPS ?? Object.keys(CLIPS).join(",")).split(",");
// Un panneau s'ouvre par son bouton (libellé FR, i18n `player`) ; absent = consigné.
const PANELS = { vitesse: "^Vitesse de lecture$", pistes: "^Pistes$" };
const states = (process.env.LG8_STATES ?? "controles,vitesse,pistes").split(",");
const OUT = process.env.LG8_OUT ?? outDir("lg8-lisibilite");
const [, electronPid] = readFileSync(path.join(STATE, `hold-${who}.pid`), "utf8").trim().split(" ").map(Number);

const probe = (...args) => execFileSync("node", [path.join(HERE, "../lg3/probe.mjs"), who, ...args], { encoding: "utf8", env: process.env }).trim();

async function connectPage() {
  const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
  const page = await Cdp.connect(target.webSocketDebuggerUrl);
  await page.send("Runtime.enable");
  return page;
}

function shoot(name) {
  const win = mainWindow(STATE, electronPid);
  if (!win) throw new Error("fenêtre hors écran (show refusé ?)");
  return captureWindow(win.id, path.join(OUT, `${name}.png`));
}

/** Un état du lecteur : panneau ouvert si demandé, relevé, deux captures. */
async function captureState(page, clip, state) {
  await showControls(page);
  let opened = null;
  if (state !== "controles") {
    opened = await centerOf(page, "button[aria-label]", PANELS[state]);
    if (!opened) return { state, absent: true };
    await clickAt(page, opened.x, opened.y);
  }
  await sleep(1300);
  const seen = await page.evaluate(COLLECT);
  const full = shoot(`${clip}-${state}`);
  await page.evaluate(SET_BARE(true));
  await sleep(250);
  const bare = shoot(`${clip}-${state}-nu`);
  await page.evaluate(SET_BARE(false));
  if (opened) {
    await showControls(page);
    const again = await centerOf(page, "button[aria-label]", PANELS[state]);
    if (again) await clickAt(page, again.x, again.y);
    await sleep(500);
  }
  return { state, seen, full, bare };
}

function analyse(clip, shot) {
  if (shot.absent) return [{ clip, state: shot.state, kind: "—", name: "panneau absent", verdict: "—" }];
  const full = readRgb(shot.full);
  const bare = readRgb(shot.bare);
  const [vw, vh] = shot.seen.viewport;
  const s = full.width / vw;
  const top = full.height - vh * s;
  return shot.seen.targets.map((t) => {
    const px = { x: t.box.x * s, y: t.box.y * s + top, w: t.box.w * s, h: t.box.h * s };
    const r = elementContrast(full, bare, px);
    return { clip, state: shot.state, kind: t.kind, name: t.name, where: t.where ?? "", ...r, verdict: verdict(t.kind, r) };
  });
}

const rows = [];
const meta = { date: new Date().toISOString(), branch: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim(), commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(), skipped: [] };
for (const clip of clips) {
  const title = `Lisibilité ${CLIPS[clip]}`;
  console.log(`— ${title}`);
  // Lancer mpv ACTIVE l'app (mesuré, 22/10) : l'inactivité est exigée dès la lecture.
  if (!(await waitHidIdle(120))) {
    meta.skipped.push(`${clip} : Damien actif`);
    continue;
  }
  console.log(probe("play", title));
  console.log(probe("pause"));
  console.log(probe("show"));
  const before = /avant (\d+)/.exec(probe("activate"))?.[1] ?? "";
  const page = await connectPage();
  const shots = [];
  try {
    meta.mode ??= await page.evaluate(`return document.documentElement.getAttribute("data-liquid-glass");`);
    for (const state of states) {
      if (hidIdleSeconds() < 5) {
        meta.skipped.push(`${clip}/${state} : Damien revenu`);
        break;
      }
      shots.push(await captureState(page, clip, state));
    }
  } finally {
    page.close();
    console.log(probe("unfront", before));
  }
  for (const shot of shots) rows.push(...analyse(clip, shot));
}
writeFileSync(path.join(OUT, "mesures.json"), JSON.stringify({ meta, rows }, null, 1));
writeFileSync(path.join(OUT, "rapport.md"), report(meta, rows));
console.log(report(meta, rows).split("\n## Détail")[0]);
console.log(`preuves : ${OUT}`);
