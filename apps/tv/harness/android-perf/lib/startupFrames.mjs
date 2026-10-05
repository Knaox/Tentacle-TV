// Le film du démarrage, image par image : luminance moyenne, saturation
// moyenne et écart avec l'image précédente (`ffprobe … signalstats`), puis
// les SEGMENTS où l'image garde la même nature — ce qui dit quand l'écran de
// chargement s'en va, quand la vidéo paraît, et si elle bouge.
import { execFileSync } from "node:child_process";

/** Chaque image du film : `t` (s, depuis le début du film), `y` (luminance),
 *  `sat` (saturation), `dif` (écart de luminance avec la précédente). */
export function classifyFrames(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-f", "lavfi", "-i", `movie=${file.replace(/([:\\',])/g, "\\$1")},signalstats`,
    "-show_entries", "frame=pts_time:frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.SATAVG,lavfi.signalstats.YDIF",
    "-of", "csv=p=0",
  ], { encoding: "utf8", maxBuffer: 64 << 20 });
  return out.trim().split("\n").map((line) => {
    const [t, y, sat, dif] = line.split(",").map(Number);
    return { t, y, sat, dif };
  });
}

/** La nature d'une image : noir, vidéo du banc (la mire, très saturée), ou
 *  écran de l'app (chargement, accueil : peu saturé). `moving` : elle bouge. */
export function natureOf(frame) {
  if (frame.y < 16) return "noir";
  return frame.sat > 40 ? "vidéo" : "app";
}

/** Les segments successifs de même nature (et de même mouvement). */
export function segmentsOf(frames) {
  const segments = [];
  for (const frame of frames) {
    const nature = natureOf(frame);
    const moving = nature === "vidéo" && frame.dif > 1.5;
    const label = nature === "vidéo" ? (moving ? "vidéo qui bouge" : "vidéo figée") : nature;
    const last = segments[segments.length - 1];
    if (last && last.label === label) {
      last.to = frame.t;
      last.frames++;
    } else segments.push({ label, from: frame.t, to: frame.t, frames: 1 });
  }
  return segments;
}

/** Le résumé d'un démarrage : les segments du film (temps depuis l'OK) et les
 *  jalons du moteur, sur la même horloge (celle de l'appareil). */
export function summarizeStartup({ set, round, frames, log, filmAt }) {
  const okAt = log.find((l) => l.text === "ok")?.at ?? filmAt + 300;
  const shift = (filmAt - okAt) / 1000; // le film commence ~0,3 s avant l'OK
  const segments = segmentsOf(frames).map((s) => ({ ...s, from: +(s.from + shift).toFixed(3), to: +(s.to + shift).toFixed(3) }));
  const milestones = log.filter((l) => l.text !== "film" && l.text !== "ok").map((l) => `+${Math.round(l.at - okAt)} ms ${l.tag === "TntStart" ? "" : `[${l.tag}] `}${l.text}`);
  return { set, round, segments: segments.filter((s) => s.frames > 1 || s.label !== "app"), milestones };
}
