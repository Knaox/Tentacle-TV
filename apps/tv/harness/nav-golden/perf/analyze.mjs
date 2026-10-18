// Les chiffres du banc de fluidité, tirés des relevés bruts de la sonde.
// Toutes les heures sont celles du fil JS de l'app (Date.now) : un focus, une
// image chargée, une première image vidéo se comparent entre eux.

/** Les classes de vue d'une vidéo, et les événements qui disent sa première image. */
const VIDEO_VIEW = /Video/i;
const VIDEO_FIRST_FRAME = /ReadyForDisplay|FirstFrame|firstFrame|ExoEvent/;
const IMAGE_LOADED = /^top(Load|LoadEnd)$|onLoad$/;
/** Les composants de la zone d'aperçu (et de l'ancienne grande carte) : le fond y est une image. */
const PREVIEW_COMPONENT = /Preview|Billboard|Spotlight|Stage|Zone/;
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
  const fond = after.find(([, tag, type]) => IMAGE_LOADED.test(type) && inPreview(r.about[tag]));
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
    videoMs: video ? video[0] - tf : null,
    // Pour caler les motifs : chaque (événement, vue, composants) vu après le focus, au plus tôt.
    events: [...seen.entries()].slice(0, 25).map(([k, ms]) => `${ms} ms  ${k}`),
  };
}

/** Le plus grand déplacement d'une vue suivie, après que le focus s'est posé. */
function jumps(r, watched) {
  const trace = r.ui?.trace ?? [];
  const focus = lastFocus(r);
  if (!trace.length || !focus) return null;
  const from = focus[0] + SETTLE_MS;
  const rows = trace.filter((row) => row[0] >= from);
  if (rows.length < 2) return null;
  let max = { pt: 0, key: null, at: null };
  watched.forEach((w, i) => {
    const base = rows[0].slice(1 + i * 4, 5 + i * 4);
    if (base[0] == null) return;
    for (const row of rows) {
      const cur = row.slice(1 + i * 4, 5 + i * 4);
      if (cur[0] == null) continue;
      const d = Math.max(Math.abs(cur[0] - base[0]), Math.abs(cur[1] - base[1]));
      if (d > max.pt) max = { pt: Math.round(d * 10) / 10, key: w.key, at: row[0] - focus[0] };
    }
  });
  return { maxPt: max.pt, jumped: max.pt > JUMP_PT, key: max.key, atMsAfterFocus: max.at, watched: watched.length, frames: rows.length };
}

function dwellSummary(d) {
  const r = d.report;
  const lat = latencies(r);
  return {
    label: d.label,
    endFocus: d.endFocus,
    fondMs: lat.fondMs,
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
