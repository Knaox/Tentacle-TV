#!/usr/bin/env node
// Le MOUVEMENT d'une rangée de cartes, image par image, sur un film de l'écran
// (`screenrecord`) : pour chaque paire d'images successives, le décalage
// horizontal qui aligne le mieux la bande des vignettes — de quoi voir une
// rangée qui avance par à-coups, s'arrête, ou RECULE d'une image à l'autre
// pendant qu'on la parcourt (le « rendu étrange » d'Android TV, 2026-10-06).
//
//   node apps/tv/harness/android-perf/rowMotion.mjs <film.mp4> [--band y,h] [--from s] [--to s]
//
// `--band` : la bande filmée (pixels de l'écran filmé), par défaut celle de
// « Reprendre » sur l'accueil en 1080p. Sortie : les décalages (pixels
// d'écran, signe : le contenu va vers la gauche > 0), leurs changements de
// sens (une tenue aller-retour en compte UN) et les reculs.
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const video = args[0];
if (!video) throw new Error("usage : rowMotion.mjs <film.mp4> [--band y,h]");
const [bandY, bandH] = option("band", "530,180").split(",").map(Number);
const W = 480;
const H = 45;
const SCALE = 1920 / W;

const raw = execFileSync("ffmpeg", [
  "-loglevel", "quiet", "-i", video, "-vf", `crop=iw:${bandH}:0:${bandY},scale=${W}:${H},format=gray`,
  "-fps_mode", "passthrough", "-f", "rawvideo", "-",
], { maxBuffer: 1 << 30 });
const frameSize = W * H;
const count = Math.floor(raw.length / frameSize);
const frame = (i) => raw.subarray(i * frameSize, (i + 1) * frameSize);

/** Le décalage (en pixels réduits) qui aligne le mieux `b` sur `a` : le contenu de `a` à `x + s` est dans `b` à `x`. */
function bestShift(a, b) {
  let best = { error: Infinity, shift: 0 };
  for (let s = -40; s <= 80; s++) {
    let sum = 0;
    let n = 0;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = Math.max(0, -s); x < Math.min(W, W - s); x += 2) {
        const d = a[row + x + s] - b[row + x];
        sum += d * d;
        n++;
      }
    }
    const error = sum / n;
    if (error < best.error) best = { error, shift: s };
  }
  return best.shift;
}

const shifts = [];
for (let i = 1; i < count; i++) shifts.push(Math.round(bestShift(frame(i - 1), frame(i)) * SCALE));
const moving = shifts.filter((s) => s !== 0);
let turns = 0;
for (let i = 1; i < moving.length; i++) if (Math.sign(moving[i]) !== Math.sign(moving[i - 1])) turns++;
console.log(JSON.stringify({ video: video.split("/").pop(), frames: count, movingFrames: moving.length, directionChanges: turns, shifts }));
