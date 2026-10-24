/**
 * Les scénarios sur la VRAIE sortie (CoreAudio), volume quasi nul (0,05 : mpv
 * est cubique, soit −78 dB) : latence clic → premier son, mémoire, sortie
 * exclusive, liste des sorties.
 *
 * # Ce que « premier son » veut dire ici
 *
 * Pas l'évènement « playing » : l'instant où le PREMIER échantillon sort de
 * l'enceinte selon l'horloge de la sortie. `audio-pts` est la position de ce
 * qu'on ENTEND (mpv y retranche la latence que CoreAudio déclare pour le
 * périphérique et son tampon) ; lu à l'instant t avec la valeur p, le premier
 * échantillon (pts 0, signal plein dès l'échantillon 0 dans `onset.flac`) est
 * sorti à t − p. Lu toutes les 2 ms (pompe resserrée), sur les premières
 * lectures non nulles. Sans boucle audio ni micro sur ce Mac, c'est la mesure
 * la plus proche du haut-parleur qu'on puisse faire sans capture.
 */

import { benchEngine, close, growing, library, rate, sleep, track, type BenchEngine } from "./benchKit.mts";

interface Request {
  at: number;
  path: string;
}

async function firstAudible(b: BenchEngine, t0: number, timeoutMs = 3000): Promise<number | null> {
  const samples: number[] = [];
  while (performance.now() - t0 < timeoutMs && samples.length < 5) {
    const raw = await b.engine.readProperty("audio-pts");
    const now = performance.now();
    const p = raw === null ? NaN : Number(raw);
    if (Number.isFinite(p) && p > 0 && p < 0.5) samples.push(now - p * 1000 - t0);
  }
  return samples.length === 0 ? null : Math.min(...samples);
}

async function oneRun(b: BenchEngine, requests: Request[], name: string, play: () => void) {
  b.engine.control({ action: "stop" });
  await sleep(400);
  const t0 = performance.now();
  play();
  const audible = await firstAudible(b, t0);
  const req = requests.find((r) => r.at >= t0 && r.path.includes("onset"));
  const playing = b.events.find((e) => e.at >= t0 && e.event.type === "state" && e.event.state.status === "playing");
  return {
    name,
    firstRequestMs: req === undefined ? null : Math.round(req.at - t0),
    playingEventMs: playing === undefined ? null : Math.round(playing.at - t0),
    firstAudibleMs: audible === null ? null : Math.round(audible),
  };
}

export async function latency(requests: Request[]) {
  const runs = [];
  const b = await benchEngine({ activePumpMs: 2 }, 0.05);
  for (let i = 0; i < 6; i += 1) {
    runs.push(await oneRun(b, requests, "bibliothèque", () => b.engine.play(track(`l${i}`), library("onset.flac", null, ""), 0)));
    runs.push(await oneRun(b, requests, "extension pré-bufferisée", () =>
      b.engine.play(track(`p${i}`), growing("onset.flac", `mode=hold&head=999999999&key=lat${i}`, 3000), 0)));
  }
  // Hors bibliothèque, PAS encore en cache : le fichier s'écrit pendant la
  // lecture, 40 ko d'avance. ffmpeg lit ~124 ko avant d'ouvrir un FLAC (mesuré,
  // `avformat_find_stream_info`) : la latence suit la vitesse d'écriture.
  for (const times of [7, 2]) {
    for (let i = 0; i < 3; i += 1) {
      runs.push(await oneRun(b, requests, `extension en écriture ${times}×`, () =>
        b.engine.play(track(`w${times}${i}`), growing("onset.flac", `mode=hold&head=40000&rate=${rate(times)}&key=wr${times}-${i}`, 3000), 0)));
    }
  }
  await close(b);
  // À froid : l'instance naît au clic (le pire cas — l'app la garde chaude).
  const t0 = performance.now();
  const cold = await benchEngine({ activePumpMs: 2 }, 0.05);
  cold.engine.play(track("cold"), library("onset.flac", null, ""), 0);
  const coldAudible = await firstAudible(cold, t0);
  await close(cold);
  const summary = (name: string) => {
    const values = runs.filter((r) => r.name === name).map((r) => r.firstAudibleMs).filter((v): v is number => v !== null).sort((a, z) => a - z);
    return { name, median: values[Math.floor(values.length / 2)] ?? null, max: values[values.length - 1] ?? null, n: values.length };
  };
  return { runs, summary: [summary("bibliothèque"), summary("extension pré-bufferisée"), summary("extension en écriture 7×"), summary("extension en écriture 2×")], coldInstanceMs: coldAudible === null ? null : Math.round(coldAudible) };
}

export async function ram() {
  const mib = (n: number): number => Math.round((n / 1048576) * 10) / 10;
  const before = process.memoryUsage().rss;
  const b = await benchEngine({}, 0.05);
  await sleep(300);
  const idle = process.memoryUsage().rss;
  b.engine.play(track("ram"), library("formats/flac-24-96.flac", null, ""), 0);
  await sleep(2000);
  const playing = process.memoryUsage().rss;
  await close(b);
  await sleep(800);
  const after = process.memoryUsage().rss;
  return { rssBeforeMiB: mib(before), idleInstanceMiB: mib(idle), playingFlac2496MiB: mib(playing), afterDisposeMiB: mib(after),
    deltaIdleMiB: mib(idle - before), deltaPlayingMiB: mib(playing - before) };
}

export async function exclusive() {
  const b = await benchEngine({}, 0.05);
  b.engine.play(track("x"), library("onset.flac", null, ""), 0);
  await b.waitFor((e) => e.type === "state" && e.state.status === "playing", 5000);
  const before = await b.engine.readProperty("current-ao");
  await b.engine.setOutput("auto", true);
  await sleep(600);
  const during = await b.engine.readProperty("current-ao");
  const params = await b.engine.readProperty("audio-out-params");
  const state = b.last();
  await b.engine.setOutput(null, false);
  await sleep(600);
  const after = await b.engine.readProperty("current-ao");
  await close(b);
  return { before, during, params, stateOutput: state?.output ?? null, after };
}

export async function outputs() {
  const b = await benchEngine({}, 0.05);
  const list = await b.engine.listOutputs();
  await close(b);
  return list;
}
