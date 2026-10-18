// Les chiffres du banc de fluidité, tirés des relevés bruts de la sonde.
// Toutes les heures sont celles du fil JS de l'app (Date.now) : un focus, une
// image chargée, une première image vidéo se comparent entre eux.

/** Les classes de vue d'une vidéo, et les événements qui disent sa première image. */
const VIDEO_VIEW = /Video/i;
const VIDEO_FIRST_FRAME = /ReadyForDisplay|FirstFrame|firstFrame|ExoEvent/;
const IMAGE_LOADED = /^top(Load|LoadEnd)$|onLoad$/;
/** Les composants de la zone d'aperçu (et de l'ancienne grande carte) : le fond y est une image. */
const PREVIEW_COMPONENT = /Preview|Billboard|Spotlight|Stage|Zone|BackdropLayer/;
/** Un cadre qui bouge de plus de 2 pt sans geste : un saut. */
const JUMP_PT = 2;
/** Le zoom du focus a fini de se poser : la référence des cadres pour les sauts. */
const SETTLE_MS = 700;

const worst = (long) => (long?.length ? Math.max(...long.map((l) => l[1])) : 0);
const thread = (r) => (r ? { fps60: r.fps60, dropped: r.dropped, hitches: r.hitches, worstMs: worst(r.long) } : null);

function burstSummary(b) {
  const r = b.report;
  return {
    label: b.label,
    endFocus: b.endFocus,
    sentMs: b.sentMs,
    ui: thread(r.ui),
    js: thread(r.js),
    views: { created: r.createsTotal, updated: r.updates, removed: r.removes },
  };
}

/** Le dernier focus d'un relevé (celui qui est tenu). */
const lastFocus = (r) => (r.focus.length ? r.focus[r.focus.length - 1] : null);

function inPreview(about) {
  return Boolean(about && about.names && about.names.some((n) => PREVIEW_COMPONENT.test(n)));
}

/** Focus → fond affiché, focus → première image vidéo, après le DERNIER focus du relevé. */
function latencies(r) {
  const focus = lastFocus(r);
  if (!focus) return { fondMs: null, videoMs: null };
  const [tf] = focus;
  const after = r.events.filter(([t]) => t >= tf);
  const fond = after.find(([, tag, type]) => IMAGE_LOADED.test(type) && inPreview(r.about[tag]) && !(r.about[tag]?.names ?? []).includes("TitleArt"));
  // Le fond DEMANDÉ (source posée sur une image de la zone) : sans gestionnaire `onLoad`, aucun
  // événement natif ne dit qu'il est chargé ; un fond en cache paraît à l'image suivante.
  const isBackdrop = (a) => inPreview(a) && !(a?.names ?? []).includes("TitleArt");
  const fondSet = after.find(([, tag, type]) => type === "setSource" && /Image/.test(String(r.about[tag]?.view)) && isBackdrop(r.about[tag]));
  const videoSet = after.find(([, tag, type]) => type === "setSource" && VIDEO_VIEW.test(String(r.about[tag]?.view)));
  // Une vidéo encore MONTÉE au relevé (un lecteur démonté qui rend sa dernière image n'est pas l'aperçu du focus).
  const video = after.find(([, tag, type]) => VIDEO_FIRST_FRAME.test(type) && !r.about[tag]?.gone && (VIDEO_VIEW.test(String(r.about[tag]?.view)) || inPreview(r.about[tag])));
  const seen = new Map();
  for (const [t, tag, type] of after) {
    const a = r.about[tag] ?? {};
    const k = `${type} · ${a.view ?? "?"} · ${(a.names ?? []).slice(0, 4).join(" < ")}`;
    if (!seen.has(k)) seen.set(k, t - tf);
  }
  return {
    fondMs: fond ? fond[0] - tf : null,
    fondSetMs: fondSet ? fondSet[0] - tf : null,
    videoSetMs: videoSet ? videoSet[0] - tf : null,
    videoMs: video ? video[0] - tf : null,
    // Pour caler les motifs : chaque (événement, vue, composants) vu après le focus, au plus tôt.
    events: [...seen.entries()].slice(0, 25).map(([k, ms]) => `${ms} ms  ${k}`),
  };
}

/**
 * Les cadres des vues suivies après le focus : `settledAtMs`, l'instant où plus
 * rien ne bouge (dernier écart > 0,5 pt d'une image à l'autre) ; puis, une fois
 * le zoom posé (`SETTLE_MS`), le plus grand déplacement (`maxPt`) et le plus
 * grand pas d'une image à l'autre (`maxStepPt`) — un défilement qui finit sa
 * course avance de moins de 2 pt par image, un saut de mise en page d'un coup.
 */
function jumps(r, watched) {
  const trace = r.ui?.trace ?? [];
  const focus = lastFocus(r);
  if (!trace.length || !focus) return null;
  const tf = focus[0];
  const all = trace.filter((row) => row[0] >= tf);
  let settledAt = 0;
  let max = { pt: 0, key: null, at: null };
  let step = { pt: 0, key: null, at: null };
  const from = tf + SETTLE_MS;
  const base = all.find((row) => row[0] >= from);
  watched.forEach((w, i) => {
    const at = (row) => row.slice(1 + i * 4, 5 + i * 4);
    for (let k = 1; k < all.length; k++) {
      const prev = at(all[k - 1]);
      const cur = at(all[k]);
      if (cur[0] == null || prev[0] == null) continue;
      const d = Math.max(Math.abs(cur[0] - prev[0]), Math.abs(cur[1] - prev[1]));
      if (d > 0.5) settledAt = Math.max(settledAt, all[k][0] - tf);
      if (all[k][0] >= from && d > step.pt) step = { pt: Math.round(d * 10) / 10, key: w.key, at: all[k][0] - tf };
      if (base && all[k][0] >= from) {
        const b = at(base);
        if (b[0] == null) continue;
        const m = Math.max(Math.abs(cur[0] - b[0]), Math.abs(cur[1] - b[1]));
        if (m > max.pt) max = { pt: Math.round(m * 10) / 10, key: w.key, at: all[k][0] - tf };
      }
    }
  });
  return { settledAtMs: settledAt, maxPt: max.pt, maxStepPt: step.pt, jumped: step.pt > JUMP_PT, key: step.pt > JUMP_PT ? step.key : max.key, atMsAfterFocus: step.pt > JUMP_PT ? step.at : max.at, watched: watched.length };
}

function dwellSummary(d) {
  const r = d.report;
  const lat = latencies(r);
  return {
    label: d.label,
    endFocus: d.endFocus,
    fondMs: lat.fondMs,
    fondSetMs: lat.fondSetMs,
    videoSetMs: lat.videoSetMs,
    videoMs: lat.videoMs,
    jumps: jumps(r, r.watched ?? []),
    ui: thread(r.ui),
    js: thread(r.js),
    views: { created: r.createsTotal, removed: r.removes, video: r.creates.filter((c) => VIDEO_VIEW.test(c[2])).length },
    events: lat.events,
  };
}

function playerSummary(raw) {
  const r = raw.report;
  const videoCreates = r.creates.filter((c) => VIDEO_VIEW.test(c[2]));
  return {
    mountedBefore: raw.before.length,
    mountedPerStep: raw.steps.map((s) => s.mounted.length),
    mountedAfter: raw.after.length,
    videoViewsCreated: videoCreates.length,
    videoClasses: [...new Set(videoCreates.map((c) => c[2]))],
    removedViews: r.removes,
    createdViews: r.createsTotal,
    ui: thread(r.ui),
    js: thread(r.js),
  };
}

function memorySummary(raw) {
  const s = raw.samples;
  const mb = (kb) => (kb == null ? null : Math.round(kb / 102.4) / 10);
  const first = s[0];
  const last = s[s.length - 1];
  const rss = s.map((x) => x.rss?.rssKb).filter((v) => v != null);
  return {
    minutes: raw.minutes,
    cycles: raw.cycles,
    rssMb: { start: mb(first.rss?.rssKb), end: mb(last.rss?.rssKb), max: mb(Math.max(...rss)), min: mb(Math.min(...rss)) },
    heapMb: { start: first.heap ? Math.round(first.heap.heap / 104857.6) / 10 : null, end: last.heap ? Math.round(last.heap.heap / 104857.6) / 10 : null },
    gcs: last.heap?.gcs ?? null,
    series: s.map((x) => [Math.round((x.t - first.t) / 1000), mb(x.rss?.rssKb), x.heap ? Math.round(x.heap.heap / 104857.6) / 10 : null]),
    pidStable: new Set(s.map((x) => x.rss?.pid)).size === 1,
  };
}

export function summarize(suite, raw) {
  if (raw.bursts) return raw.bursts.map(burstSummary);
  if (raw.dwells) return raw.dwells.map(dwellSummary);
  if (suite === "lecteur") return playerSummary(raw);
  if (suite === "memoire") return memorySummary(raw);
  return raw;
}
