// Banc de fluidité (lot lg5) : les ÉTAPES du pipeline d'une image (sous-tranches
// de `PipelineReporter`) — fil principal (`SendBeginMainFrameToCommit`),
// rastérisation (`EndCommitToActivation`), dessin du processus GPU
// (`StartDrawToSwapStart` : flous, lentilles, compositing). Médiane et p95, en ms.
export const STAGES = [
  "SendBeginMainFrameToCommit",
  "EndCommitToActivation",
  "EndActivateToSubmitCompositorFrame",
  "SubmitToReceiveCompositorFrame",
  "ReceiveCompositorFrameToStartDraw",
  "StartDrawToSwapStart",
];

const q = (sorted, p) => (sorted.length === 0 ? null : Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] * 10) / 10);

/**
 * `window` : [début, fin] en ms de la trace (`markWindow`), ou toute la trace ;
 * ou une LISTE de fenêtres (les ouvertures de menus : `openWindows`).
 */
export function stageStats(events, window = null) {
  const windows = window === null ? null : Array.isArray(window[0]) ? window : [window];
  const open = new Map();
  const spans = Object.fromEntries(STAGES.map((s) => [s, []]));
  for (const e of events.filter((x) => STAGES.includes(x.name)).sort((a, b) => a.ts - b.ts)) {
    const key = `${e.name}:${e.pid}:${e.id2?.local ?? e.id}`;
    if (e.ph === "b") open.set(key, [...(open.get(key) ?? []), e.ts]);
    else if (e.ph === "e") {
      const begin = open.get(key)?.pop();
      if (begin === undefined) continue;
      if (windows !== null && !windows.some(([a, b]) => begin / 1000 >= a && begin / 1000 <= b)) continue;
      spans[e.name].push((e.ts - begin) / 1000);
    }
  }
  return Object.fromEntries(
    Object.entries(spans).map(([name, list]) => {
      const sorted = list.sort((a, b) => a - b);
      return [name, { n: sorted.length, p50: q(sorted, 0.5), p95: q(sorted, 0.95), max: q(sorted, 1) }];
    }),
  );
}

/** Les 350 ms qui suivent chaque `performance.mark("lg5:open")` : l'animation d'ouverture. */
export function openWindows(events, ms = 350) {
  return events
    .filter((e) => e.name === "lg5:open" && e.cat?.includes("blink.user_timing"))
    .map((e) => [e.ts / 1000, e.ts / 1000 + ms]);
}
