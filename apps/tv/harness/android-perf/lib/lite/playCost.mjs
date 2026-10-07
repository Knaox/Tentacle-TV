// Le COÛT D'UNE LECTURE sur une box faible (tâche L4) : un jeu du faux
// backend (`lecteur/flux-l4-*` : image légère, son ou sous-titre lourd), la
// lecture lancée depuis « Reprendre », puis une fenêtre de mesure SANS AUCUNE
// TOUCHE — le temps processeur de chaque fil de l'app, ramené à la seconde
// (ms de processeur par seconde de lecture : 1000 = un cœur plein).
//
// L'image (H.264 640×360) est décodée par l'hôte de l'émulateur
// (`c2.goldfish.*`) : ce qui se lit, c'est le son décodé par l'extension
// FFmpeg et le rendu des sous-titres, sur les cœurs de l'appareil, freinés
// comme le reste (`--throttle`).
import fs from "node:fs";
import path from "node:path";
import { PACKAGE, sleep } from "../device.mjs";
import { createCapture } from "./capture.mjs";
import { applyThrottle, hostLoad, qemuPidOf } from "./throttle.mjs";

/** Les jeux mesurables, et ce qu'ils chargent (`nav-golden/scenarios/lecteur/fixtures.mjs`). */
export const PLAY_COST_SETS = ["aac", "ac3", "eac3", "dts", "truehd", "ass", "pgs"];
// `debit` (image à ~30 Mb/s) ne se mesure que demandé : il montre le TAMPON d'Exo (tas Java), pas un coût de décodage.

/** Les fils les plus coûteux d'une fenêtre, en ms de processeur par seconde. */
export function perSecond(before, after, seconds, top = 60) {
  const rows = [];
  let total = 0;
  for (const [name, ns] of Object.entries(after)) {
    const delta = (ns - (before[name] ?? 0)) / 1e6;
    if (delta <= 0) continue;
    total += delta;
    rows.push([name, Math.round((delta / seconds) * 10) / 10]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  return { totalMsPerS: Math.round((total / seconds) * 10) / 10, threads: rows.slice(0, top) };
}

/**
 * Une passe par jeu : lancement à froid, « Reprendre » (BAS puis OK — les
 * deux seules touches, sous la garde), 12 s pour que la lecture s'installe,
 * puis la fenêtre mesurée, freinée, sans touche.
 */
export async function measurePlayCost({ device, applyFixtures, sets, spec, windowS, dir, log }) {
  const results = [];
  for (const set of sets) {
    applyFixtures(["base/vigie-off", `lecteur/flux-l4-${set}`]);
    // Le lecteur DOIT être atteint : sous une forte charge, BAS arrive avant
    // que l'accueil ait posé son focus et OK ouvre autre chose — la passe est
    // rejouée une fois, jamais mesurée ailleurs.
    let reached = false;
    for (let attempt = 0; attempt < 2 && !reached; attempt++) {
      device.forceStop();
      device.clearLog();
      device.launch();
      if (!(await device.waitReady("accueil", 60_000))) throw new Error(`${set} : l'accueil ne s'est jamais dit prêt`);
      await sleep(5000);
      device.keys("tap:20", "wait:2500", "tap:23", "wait:12000");
      reached = device.screens().includes("Player");
    }
    if (!reached) {
      log(`${set} : le lecteur n'a pas été atteint (écrans : ${device.screens().join(" → ")}) — jeu sauté`);
      continue;
    }
    const lift = device.serial.startsWith("emulator-") ? applyThrottle(qemuPidOf(device.serial), spec) : () => {};
    const load = [hostLoad()];
    const before = device.threadCpu();
    const started = Date.now();
    try {
      await sleep(windowS * 1000);
    } finally {
      lift();
    }
    const after = device.threadCpu();
    load.push(hostLoad());
    const seconds = (Date.now() - started) / 1000;
    const cost = perSecond(before, after, seconds);
    device.screencap(path.join(dir, `${set}.png`));
    const journal = device.adb(["logcat", "-d", "-s", "ExoPlayerView:W", "MediaCodecInfo:*", "FfmpegLibrary:*"]);
    fs.writeFileSync(path.join(dir, `${set}.logcat.txt`), journal);
    // La mémoire de l'app EN LECTURE : le tampon d'Exo vit dans le tas Java.
    const memory = createCapture(device.serial, PACKAGE).meminfo();
    const row = { set, spec, seconds: Math.round(seconds), hostLoad: load, ...cost, memory, playing: device.pid() !== null };
    results.push(row);
    log(`${set} : ${cost.totalMsPerS} ms/s au total — ${cost.threads.slice(0, 4).map(([n, v]) => `${n} ${v}`).join(", ")} · PSS ${memory.totalPss} Mo (Java ${memory.javaHeap}) (charge ${load.join(" → ")})`);
  }
  device.forceStop();
  return results;
}

export { PACKAGE };
