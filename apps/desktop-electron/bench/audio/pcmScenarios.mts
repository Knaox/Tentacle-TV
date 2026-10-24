/**
 * Les scénarios mesurés À L'ÉCHANTILLON sur la sortie PCM du moteur :
 * enchaînement de l'album continu, bascule à chaud du titre en cours et du
 * suivant, fin provisoire d'un fichier qui grandit, formats.
 *
 * Chaque scénario rend un verdict chiffré : les évènements de discontinuité du
 * comparateur (`pcmCompare.mjs` : aucun = bit pour bit).
 */

import path from "node:path";
import { comparePcm, rmsOf } from "./pcmCompare.mjs";
import { benchEngine, close, ended, growing, library, pcmOutput, rate, track } from "./benchKit.mts";

const D1 = 4000; // album-1 : 176 423 trames ≈ 4,000 s

export async function gapless(fx: string, out: string) {
  const b = await benchEngine({ extraOptions: pcmOutput(out) });
  b.engine.play(track("t1"), library("album-1.flac"), 0);
  b.engine.setNext(track("t2"), library("album-2.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2");
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t3");
  await b.waitFor(ended);
  await close(b);
  return { advanced: b.events.filter((e) => e.event.type === "advanced").length, ...comparePcm(out, path.join(fx, "album.ref.s16")) };
}

/**
 * La source du titre EN COURS passe d'un fichier qui grandit (extension) au
 * fichier de la bibliothèque, au milieu du titre ; le suivant, retenu tant que
 * le titre était incomplet, enchaîne ensuite sans blanc.
 */
export async function swapCurrent(fx: string, out: string) {
  const b = await benchEngine({ extraOptions: pcmOutput(out), leadS: 2 });
  b.engine.play(track("t1", D1), growing("album-1.flac", `mode=hold&rate=${rate(1.1)}&head=100000&key=sc`, D1), 0);
  b.engine.setNext(track("t2"), library("album-2.flac"));
  await b.waitFor((e) => e.type === "state" && e.state.status === "playing", 10_000, 0);
  const askedAt = performance.now();
  const askedAtMs = b.last()?.positionMs ?? null;
  b.engine.swap("t1", library("album-1.flac"));
  const swapped = await b.waitFor((e) => e.type === "swapped", 10_000, askedAt);
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2", 30_000, askedAt);
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor(ended);
  await close(b);
  return { askedAtMs, swappedAfterMs: Math.round(swapped.at - askedAt), ...comparePcm(out, path.join(fx, "album.ref.s16")) };
}

/** Le SUIVANT (déjà préchargé depuis l'extension) bascule vers la bibliothèque avant son tour. */
export async function swapNext(fx: string, out: string) {
  const b = await benchEngine({ extraOptions: pcmOutput(out) });
  b.engine.play(track("t1"), library("album-1.flac"), 0);
  b.engine.setNext(track("t2"), growing("album-2.flac", `mode=hold&rate=${rate(7)}&key=sn`, 4000));
  b.engine.swap("t2", library("album-2.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2");
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor(ended);
  await close(b);
  return comparePcm(out, path.join(fx, "album.ref.s16"));
}

/**
 * Fin PROVISOIRE : le serveur rend ce qui est écrit et ferme. ffmpeg se
 * reconnecte, puis le moteur relit à la position ; le titre va au bout et le
 * suivant (retenu) part à la vraie fin.
 */
export async function provisionalEnd(fx: string, out: string, bps = rate(0.8)) {
  const b = await benchEngine({ extraOptions: pcmOutput(out) });
  b.engine.play(track("t1", D1), growing("album-1.flac", `mode=close&total=final&rate=${bps}&head=100000&key=pe${bps}`, D1), 0);
  b.engine.setNext(track("t2"), library("album-2.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2", 60_000);
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor(ended, 60_000);
  await close(b);
  const statuses = b.events.flatMap((e) => (e.event.type === "state" ? [e.event.state.status] : []));
  return { buffering: statuses.filter((s) => s === "buffering").length, ...comparePcm(out, path.join(fx, "album.ref.s16")) };
}

export async function formats(fx: string, outDir: string) {
  const files = ["flac-24-96.flac", "alac.m4a", "pcm.wav", "opus.opus", "aac.m4a", "mp3.mp3", "dsd64.dsf"];
  const rows = [];
  for (const file of files) {
    const out = path.join(outDir, `fmt-${file}.raw`);
    const b = await benchEngine({ extraOptions: { ...pcmOutput(out), "audio-format": "s16", "audio-samplerate": "44100" } });
    b.engine.play(track(file), library(`formats/${file}`), 0);
    await b.waitFor(ended, 20_000).catch(() => null);
    const state = b.last();
    await close(b);
    rows.push({ file, format: state?.format ?? null, status: state?.status, rms: Number(rmsOf(out).toFixed(3)) });
  }
  return rows;
}

/**
 * Le flux TENU (le relais diffuse à mesure qu'il écrit) : `hold`. Avec
 * `rate` sous le débit du titre (FLAC ≈ 32 ko/s), l'écriture est plus LENTE que
 * la lecture : le moteur attend (`buffering`), sans rien sauter ni répéter.
 */
export async function growingHold(fx: string, out: string, times: number) {
  const bps = rate(times);
  const b = await benchEngine({ extraOptions: pcmOutput(out) });
  b.engine.play(track("t1", D1), growing("album-1.flac", `mode=hold&rate=${bps}&head=100000&key=gh${bps}`, D1), 0);
  b.engine.setNext(track("t2"), library("album-2.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2", 60_000, 0);
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor(ended, 60_000, 0);
  await close(b);
  const statuses = b.events.flatMap((e) => (e.event.type === "state" ? [e.event.state.status] : []));
  return { times, buffering: statuses.filter((s) => s === "buffering").length, ...comparePcm(out, path.join(fx, "album.ref.s16")) };
}

/**
 * L'écrivain CALE 7 s au tiers du titre : ffmpeg abandonne ses reconnexions
 * (≤ 4 s), mpv s'arrête sur une fin PROVISOIRE, et c'est le moteur qui relit à
 * la position jusqu'à ce que le fichier reprenne (`ProvisionalEnd`). Le raccord
 * de la relecture est mesuré à l'échantillon.
 */
export async function writerStall(fx: string, out: string) {
  const b = await benchEngine({ extraOptions: pcmOutput(out) });
  b.engine.play(track("t1", D1), growing("album-1.flac", `mode=close&total=final&rate=${rate(3)}&head=60000&stall=190000:7000&key=st`, D1), 0);
  b.engine.setNext(track("t2"), library("album-2.flac"));
  await b.waitFor((e) => e.type === "advanced" && e.toKey === "t2", 60_000, 0);
  b.engine.setNext(track("t3"), library("album-3.flac"));
  await b.waitFor(ended, 60_000, 0);
  await close(b);
  const statuses = b.events.flatMap((e) => (e.event.type === "state" ? [e.event.state.status] : []));
  return { buffering: statuses.filter((s) => s === "buffering").length, ...comparePcm(out, path.join(fx, "album.ref.s16")) };
}
