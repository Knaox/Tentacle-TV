/**
 * Les raccords mesurés EN TEMPS RÉEL, sur la vraie sortie CoreAudio (volume
 * 0,05 : −78 dB).
 *
 * La sortie PCM du banc prouve la CONTINUITÉ des échantillons, pas leur
 * HORAIRE : elle n'est pas cadencée, un blanc dû à un rechargement n'y laisse
 * aucune trace. Ici, on relit `audio-pts` (la position de ce qu'on ENTEND)
 * toutes les 2 ms avec l'horloge murale ; au raccord entre deux lectures
 * (p₁ à t₁ dans le titre A, p₂ à t₂ dans le titre B) :
 *
 *   blanc = (t₂ − t₁) − ((durée(A) − p₁) + p₂)
 *
 * 0 à la précision du relevé près (± 3 ms) = sans blanc. Pour une bascule
 * (même chronologie, B démarre à T) : blanc = (t₂ − t₁) − (p₂ − p₁).
 */

import { benchEngine, close, growing, library, rate, track, type BenchEngine } from "./benchKit.mts";

const RATE = 44100;
const DURATIONS = [176423 / RATE, (352911 - 176423) / RATE, (529271 - 352911) / RATE];

interface Sample {
  t: number;
  pts: number;
}

/** Relève `audio-pts` jusqu'à `stop()` ; un saut de titre = une baisse de la position. */
async function record(b: BenchEngine, until: () => boolean, maxMs: number): Promise<Sample[]> {
  const samples: Sample[] = [];
  const t0 = performance.now();
  while (!until() && performance.now() - t0 < maxMs) {
    const raw = await b.engine.readProperty("audio-pts");
    const pts = raw === null ? NaN : Number(raw);
    if (Number.isFinite(pts)) samples.push({ t: performance.now(), pts });
  }
  return samples;
}

/** Les raccords : chaque recul de la position, et le blanc calculé. */
function junctions(samples: Sample[], durationOf: (index: number) => number, sameTimeline: boolean) {
  const out = [];
  let index = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1] as Sample;
    const b = samples[i] as Sample;
    if (b.pts >= a.pts - 0.05) continue;
    const media = sameTimeline ? b.pts - a.pts : durationOf(index) - a.pts + b.pts;
    out.push({ atMs: Math.round(a.t), gapMs: Number((b.t - a.t - media * 1000).toFixed(1)), pollMs: Number((b.t - a.t).toFixed(1)) });
    index += 1;
  }
  return out;
}

const isEnded = (b: BenchEngine) => () => b.last()?.status === "ended";

/** L'album continu, enchaîné par le moteur (suivant préchargé dans mpv). */
export async function gaplessRealtime() {
  const b = await benchEngine({ activePumpMs: 2 }, 0.05);
  b.engine.play(track("t1"), library("album-1.flac", null, ""), 0);
  b.engine.setNext(track("t2"), library("album-2.flac", null, ""));
  void b.waitFor((e) => e.type === "advanced" && e.toKey === "t2").then(() => b.engine.setNext(track("t3"), library("album-3.flac", null, "")));
  const samples = await record(b, isEnded(b), 20_000);
  await close(b);
  return { samples: samples.length, junctions: junctions(samples, (i) => DURATIONS[i] ?? 0, false) };
}

/**
 * Le titre en cours lu depuis un fichier qui grandit (flux tenu, ~1,9× le temps
 * réel), basculé au milieu vers la bibliothèque : la bascule ne doit RIEN
 * coûter. Puis le suivant (retenu tant que le titre était incomplet) enchaîne.
 */
export async function swapRealtime() {
  const b = await benchEngine({ activePumpMs: 2 }, 0.05);
  b.engine.play(track("t1", 4000), growing("album-1.flac", `mode=hold&rate=${rate(1.9)}&head=150000&key=rt-swap`, 4000), 0);
  b.engine.setNext(track("t2"), library("album-2.flac", null, ""));
  await b.waitFor((e) => e.type === "state" && e.state.status === "playing", 10_000, 0);
  b.engine.swap("t1", library("album-1.flac", null, ""));
  // L'entrée de bascule est une EDL qui commence à T : sa position repart de
  // 0. On relit T dans son adresse pour remettre la chronologie du titre.
  let fromS = 0;
  void b.waitFor((e) => e.type === "swapped", 10_000, 0).then(async () => {
    fromS = Number(/start=([\d.]+)/.exec((await b.engine.readProperty("path")) ?? "")?.[1] ?? 0);
  });
  const raw = await record(b, () => b.events.some((e) => e.event.type === "advanced"), 15_000);
  const jump = raw.findIndex((s, i) => i > 0 && s.pts < (raw[i - 1] as Sample).pts - 0.05);
  const samples = raw.map((s, i) => (jump > 0 && i >= jump ? { t: s.t, pts: s.pts + fromS } : s));
  // Avant le passage au titre suivant : seule la bascule compte ici.
  const end = samples.findIndex((s, i) => i > jump && i > 0 && s.pts < (samples[i - 1] as Sample).pts - 0.05);
  const window = samples.slice(Math.max(1, jump - 50), end < 0 ? samples.length : end);
  let worst = 0;
  for (let i = 1; i < window.length; i += 1) {
    const d = (window[i] as Sample).t - (window[i - 1] as Sample).t - ((window[i] as Sample).pts - (window[i - 1] as Sample).pts) * 1000;
    if (Math.abs(d) > Math.abs(worst)) worst = d;
  }
  const at = jump > 0 ? samples[jump] : null;
  const before = jump > 0 ? samples[jump - 1] : null;
  await close(b);
  return {
    samples: raw.length,
    swapAtS: fromS,
    junctionDriftMs: at && before ? Number((at.t - before.t - (at.pts - before.pts) * 1000).toFixed(1)) : null,
    worstStepDriftMs: Number(worst.toFixed(1)),
  };
}

/**
 * Un suivant RETENU (titre en cours incomplet jusqu'au bout, aucune bascule) :
 * il part dans mpv dès que le fichier est entier en cache
 * (`markCurrentComplete`) — l'enchaînement doit rester sans blanc.
 */
export async function heldRealtime() {
  const b = await benchEngine({ activePumpMs: 2 }, 0.05);
  b.engine.play(track("t1", 4000), growing("album-1.flac", `mode=hold&rate=${rate(1.9)}&head=150000&key=rt-held`, 4000), 0);
  b.engine.setNext(track("t2"), library("album-2.flac", null, ""));
  const advancedAt = (): number => b.events.find((e) => e.event.type === "advanced")?.at ?? Infinity;
  const samples = await record(b, () => performance.now() - advancedAt() > 600, 15_000);
  await close(b);
  return { samples: samples.length, junctions: junctions(samples, (i) => DURATIONS[i] ?? 0, false) };
}
