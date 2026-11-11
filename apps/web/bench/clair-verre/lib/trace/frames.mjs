// Banc de fluidité (lot lg5) : les IMAGES, une par une, par une trace de
// Chromium prise en CDP (`Tracing`), jamais par une boucle
// `requestAnimationFrame` dans la page (elle fabriquerait les images qu'on
// compte, comme le compteur de dev/).
//
// Source des images, dans l'ordre :
//  1. `PipelineReporter` (catégorie `benchmark`) : une tranche par image du
//     compositeur, avec son état (présentée, abandonnée…) et sa durée de
//     production — ce que lit le panneau Performance de DevTools ;
//  2. sinon `Display::DrawAndSwap` (viz) : chaque image réellement envoyée à
//     l'écran ; l'intervalle entre deux envois dit ce qui a manqué.
import { Buffer } from "node:buffer";

export const TRACE_CATEGORIES = [
  "benchmark",
  "blink.user_timing",
  "viz",
  "disabled-by-default-devtools.timeline.frame",
].join(",");

/** Démarre la trace sur la page (`Cdp` du banc). */
export async function startTrace(page) {
  await page.send("Tracing.start", {
    traceConfig: { recordMode: "recordAsMuchAsPossible", includedCategories: TRACE_CATEGORIES.split(",") },
    transferMode: "ReturnAsStream",
  });
}

/** Arrête la trace et rend ses évènements (flux lu morceau par morceau). */
export async function stopTrace(page) {
  const done = new Promise((resolve) => page.on("Tracing.tracingComplete", resolve));
  await page.send("Tracing.end");
  const { stream } = await done;
  const chunks = [];
  for (;;) {
    const { data, eof, base64Encoded } = await page.send("IO.read", { handle: stream, size: 4 << 20 });
    chunks.push(base64Encoded ? Buffer.from(data, "base64").toString("utf8") : data);
    if (eof) break;
  }
  await page.send("IO.close", { handle: stream });
  const parsed = JSON.parse(chunks.join(""));
  return Array.isArray(parsed) ? parsed : parsed.traceEvents ?? [];
}

const quantile = (sorted, q) => (sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
const round = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);

/** La période d'affichage : 8,33 ms (ProMotion) ou 16,67 ms, d'après les intervalles les plus courts. */
export function vsyncOf(intervals) {
  const short = intervals.filter((d) => d > 4 && d < 20).sort((a, b) => a - b);
  if (short.length < 5) return 1000 / 60;
  return quantile(short, 0.2) < 12 ? 1000 / 120 : 1000 / 60;
}

/**
 * Les images présentées (horodatages en ms) et la durée de production de
 * chacune, d'après les évènements d'une trace — `PipelineReporter` s'il est là.
 */
export function framesOf(events) {
  // Les identifiants (`id2.local`) se RÉUTILISENT d'une image à l'autre : une
  // pile par identifiant apparie chaque fin à son début. L'état est sur le début.
  const open = new Map();
  const complete = [];
  for (const e of [...events].filter((x) => x.name === "PipelineReporter").sort((a, b) => a.ts - b.ts)) {
    const key = `${e.pid}:${e.id ?? e.id2?.local ?? e.id2?.global}`;
    if (e.ph === "b") {
      const stack = open.get(key) ?? [];
      stack.push({ begin: e.ts, pid: e.pid, state: e.args?.frame_reporter?.state ?? e.args?.chrome_frame_reporter?.state ?? null });
      open.set(key, stack);
    } else if (e.ph === "e") {
      const entry = open.get(key)?.pop();
      if (entry) complete.push({ ...entry, end: e.ts });
    }
  }
  if (complete.length > 0) {
    // Le processus de RENDU de la page porte le plus de tranches.
    const byPid = new Map();
    for (const f of complete) byPid.set(f.pid, (byPid.get(f.pid) ?? 0) + 1);
    const pid = [...byPid].sort((a, b) => b[1] - a[1])[0][0];
    const mine = complete.filter((f) => f.pid === pid).sort((a, b) => a.end - b.end);
    // `NO_UPDATE_DESIRED` : rien à dessiner à ce battement, ce n'est pas une image.
    const presented = mine.filter((f) => /PRESENTED/.test(String(f.state)));
    const dropped = mine.filter((f) => /DROPPED/.test(String(f.state)));
    return {
      source: "PipelineReporter",
      times: presented.map((f) => f.end / 1000),
      durations: presented.map((f) => (f.end - f.begin) / 1000),
      dropped: dropped.length,
      // Les battements où une image était ATTENDUE, dans l'ordre : présentée ou abandonnée.
      expected: [...presented, ...dropped].sort((a, b) => a.begin - b.begin).map((f) => ({ at: f.begin / 1000, dropped: /DROPPED/.test(String(f.state)) })),
    };
  }
  const swaps = events.filter((e) => e.name === "Display::DrawAndSwap" && (e.ph === "X" || e.ph === "B"));
  const byPid = new Map();
  for (const s of swaps) byPid.set(s.pid, [...(byPid.get(s.pid) ?? []), s]);
  const busiest = [...byPid.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const sorted = busiest.sort((a, b) => a.ts - b.ts);
  return {
    source: "DrawAndSwap",
    times: sorted.map((s) => (s.ts + (s.dur ?? 0)) / 1000),
    durations: sorted.map((s) => (s.dur ?? 0) / 1000),
    dropped: null,
  };
}

/**
 * Le verdict d'une fenêtre de temps : intervalles entre images, images
 * manquées (un intervalle de k périodes en a manqué k − 1), rafales (deux
 * périodes ou plus manquées d'affilée), cadence. `window` : [début, fin] en ms
 * de la trace ; sans elle, toute la trace.
 */
export function frameStats(frames, window = null, cadenceMs = null) {
  const keep = (t) => window === null || (t >= window[0] && t <= window[1]);
  const idx = frames.times.map((t, i) => i).filter((i) => keep(frames.times[i]));
  const times = idx.map((i) => frames.times[i]);
  const durations = idx.map((i) => frames.durations[i]).sort((a, b) => a - b);
  const intervals = times.slice(1).map((t, i) => t - times[i]);
  const vsync = vsyncOf(intervals);
  // La période attendue : l'écran, ou la cadence voulue du geste si elle est plus lente.
  const period = Math.max(vsync, cadenceMs ?? 0);
  // Un silence de plus de 100 ms n'est pas une image manquée : rien n'a changé à l'écran.
  const active = intervals.filter((d) => d <= 100);
  const sorted = [...active].sort((a, b) => a - b);
  let missed = 0;
  let bursts = 0;
  for (const d of active) {
    const periods = Math.round(d / period);
    if (periods >= 2) missed += periods - 1;
    if (periods >= 3) bursts += 1;
  }
  // Le critère de Chromium : une image attendue (mise à jour voulue) qui n'a pas
  // été présentée. Indifférent à la cadence voulue (30 paliers du héros).
  const expected = (frames.expected ?? []).filter((f) => keep(f.at));
  let dropped = 0;
  let run = 0;
  let longestDropRun = 0;
  let dropBursts = 0;
  for (const f of expected) {
    if (f.dropped) {
      dropped += 1;
      run += 1;
      if (run === 2) dropBursts += 1;
      longestDropRun = Math.max(longestDropRun, run);
    } else run = 0;
  }
  const span = times.length > 1 ? times[times.length - 1] - times[0] : 0;
  return {
    source: frames.source,
    frames: times.length,
    fps: span > 0 ? round(((times.length - 1) * 1000) / span, 1) : 0,
    vsyncMs: round(vsync),
    periodMs: round(period),
    intervalMean: round(active.length ? active.reduce((s, d) => s + d, 0) / active.length : null),
    intervalP95: round(quantile(sorted, 0.95)),
    intervalP99: round(quantile(sorted, 0.99)),
    intervalMax: round(sorted[sorted.length - 1] ?? null),
    frameTimeMean: round(durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null),
    frameTimeP95: round(quantile(durations, 0.95)),
    frameTimeP99: round(quantile(durations, 0.99)),
    missed,
    missedRatio: round(active.length ? missed / (active.length + missed) : 0, 3),
    bursts,
    expected: expected.length,
    dropped,
    droppedRatio: round(expected.length ? dropped / expected.length : 0, 3),
    dropBursts,
    longestDropRun,
  };
}

/** Les bornes du geste : `performance.mark("lg5:start")` / `("lg5:end")` de la page, en ms de la trace. */
export function markWindow(events) {
  const at = (name) => events.find((e) => e.name === name && e.cat?.includes("blink.user_timing"))?.ts;
  const start = at("lg5:start");
  const end = at("lg5:end");
  return start !== undefined && end !== undefined ? [start / 1000, end / 1000] : null;
}

/** Les noms d'évènements les plus fréquents (diagnostic d'une trace inconnue). */
export function eventCensus(events, top = 25) {
  const counts = new Map();
  for (const e of events) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, top);
}
