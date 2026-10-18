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

/**
 * Le RYTHME du focus pendant une touche maintenue : pas par 500 ms, du premier
 * pas au dernier — un ralentissement au passage en défilement rapide se voit
 * à un creux (`min` bien sous `median`).
 */
function focusRate(focus) {
  if (focus.length < 4) return null;
  const t0 = focus[0][0];
  const t1 = focus[focus.length - 1][0];
  const windows = [];
  for (let t = t0; t + 500 <= t1; t += 500) windows.push(focus.filter(([at]) => at >= t && at < t + 500).length * 2);
  if (!windows.length) return null;
  const sorted = [...windows].sort((a, b) => a - b);
  return { steps: focus.length, perSecond: windows, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
}

function burstSummary(b) {
  const r = b.report;
  return {
    focusRate: focusRate(r.focus),
    // Touche maintenue : du LÂCHER au dernier focus posé (la colonne rendue) ; négatif = posé avant le lâcher.
    afterReleaseMs: b.releasedAt && r.focus.length ? r.focus[r.focus.length - 1][0] - b.releasedAt : null,
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
  // Les MOUVEMENTS de la page : des suites d'images qui bougent (> 0,5 pt), séparées d'au moins 150 ms d'immobilité (une fin de course sous 0,5 pt par image n'est pas un arrêt).
  const moving = new Set();
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
      if (d > 0.5) {
        settledAt = Math.max(settledAt, all[k][0] - tf);
        moving.add(all[k][0]);
      }
      if (all[k][0] >= from && d > step.pt) step = { pt: Math.round(d * 10) / 10, key: w.key, at: all[k][0] - tf };
      if (base && all[k][0] >= from) {
        const b = at(base);
        if (b[0] == null) continue;
        const m = Math.max(Math.abs(cur[0] - b[0]), Math.abs(cur[1] - b[1]));
        if (m > max.pt) max = { pt: Math.round(m * 10) / 10, key: w.key, at: all[k][0] - tf };
      }
    }
  });
  const times = [...moving].sort((a, b) => a - b);
  const movements = times.reduce((n, t, k) => (k === 0 || t - times[k - 1] > 150 ? n + 1 : n), 0);
  return { movements, settledAtMs: settledAt, maxPt: max.pt, maxStepPt: step.pt, jumped: step.pt > JUMP_PT, key: step.pt > JUMP_PT ? step.key : max.key, atMsAfterFocus: step.pt > JUMP_PT ? step.at : max.at, watched: watched.length };
}

/**
 * La COURSE de la rangée (la 1re vue suivie, la tête de la famille de clés),
 * depuis l'envoi du 1er geste : où elle va, en combien de temps (50 %, 90 %,
 * posée), et si elle dépasse, rebondit ou s'arrête en route (`reversals` :
 * changements de sens de plus de 0,5 pt par image).
 */
export function course(r, sentAt) {
  const trace = r.ui?.trace ?? [];
  if (!trace.length || !r.watched?.length) return null;
  const pts = trace.filter((row) => row[0] >= sentAt && row[1] != null).map((row) => [row[0] - sentAt, row[1]]);
  if (pts.length < 2) return null;
  const x0 = pts[0][1];
  const xe = pts[pts.length - 1][1];
  const total = xe - x0;
  if (Math.abs(total) < 2) return { totalPt: Math.round(total), moved: false };
  const at = (frac) => pts.find(([, x]) => Math.abs(x - x0) >= Math.abs(total) * frac)?.[0] ?? null;
  let settled = 0;
  let reversals = 0;
  let lastSign = 0;
  let maxStep = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][1] - pts[k - 1][1];
    if (Math.abs(dx) > 0.5) {
      settled = pts[k][0];
      const sign = Math.sign(dx);
      if (lastSign && sign !== lastSign) reversals += 1;
      lastSign = sign;
    }
    maxStep = Math.max(maxStep, Math.abs(dx));
  }
  const beyond = pts.map(([, x]) => (x - xe) * Math.sign(total)).reduce((m, v) => Math.max(m, v), 0);
  return { totalPt: Math.round(total), moved: true, t50: at(0.5), t90: at(0.9), settledMs: settled, overshootPt: Math.round(beyond * 10) / 10, reversals, maxStepPt: Math.round(maxStep * 10) / 10 };
}

function dwellSummary(d) {
  const r = d.report;
  const lat = latencies(r);
  return {
    label: d.label,
    endFocus: d.endFocus,
    course: d.sentAt ? course(r, d.sentAt) : undefined,
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

/**
 * Les SEUILS du « Validé fluidité » (cibles de design et nav, lot tvgrille) :
 * - rafale : fil UI ≥ 57 i/s ramenées à 60 Hz, aucun écart d'image > 100 ms ;
 * - tenue sur une carte : fond posé ≤ 200 ms, 1re image vidéo ≤ délai (800 ms) + 100 ms,
 *   aucun pas de cadre > 2 pt d'une image à l'autre une fois le zoom posé ;
 * - lecteur : jamais plus d'UNE vue vidéo montée à la fois ;
 * - mémoire : le tas JS ne dépasse pas celui de la référence de plus de 15 %.
 */
const NOT_A_TITLE = /^(filter|pill|nav|library|hero):/;

export const THRESHOLDS = { uiFps: 57, worstFrameMs: 100, fondMs: 200, videoMs: 900, jumpPt: JUMP_PT, mountedVideos: 1, heapGrowth: 1.15 };

const check = (name, ok, value, target) => ({ name, ok, value, target });

/**
 * Le fond d'une tenue sur un titre, au vert dans trois cas :
 * - posé (nouvelle source sur un calque de fond) dans le délai ;
 * - sans nouvelle source, mais CHARGÉ dans le délai : il attendait déjà dans
 *   l'autre calque du fondu croisé (un Retour, un titre revu) ;
 * - ni posé ni chargé, mais la zone a servi ce titre (sa vidéo est là) : le
 *   fond était DÉJÀ AFFICHÉ — un pas GAUCHE vers le titre d'avant.
 * Rouge : posé trop tard, ou rien du tout — ni fond ni vidéo.
 */
function fondCheck(x, T) {
  const name = `${x.label} : fond posé`;
  const target = `≤ ${T.fondMs} ms`;
  if (x.fondSetMs != null) return check(name, x.fondSetMs <= T.fondMs, x.fondSetMs, target);
  if (x.fondMs != null) return check(name, x.fondMs <= T.fondMs, `chargé ${x.fondMs} (calque prêt)`, target);
  return check(name, x.videoMs != null, x.videoMs != null ? "déjà affiché" : null, target);
}

/** Les verdicts d'une suite résumée ; `reference` (résumé de la même suite sur dev) pour la mémoire. */
export function verdicts(suite, summary, reference = null) {
  const T = THRESHOLDS;
  if (suite === "lecteur") {
    const most = Math.max(summary.mountedBefore, summary.mountedAfter, ...summary.mountedPerStep);
    return [check("lecteur : vues vidéo montées à la fois", most <= T.mountedVideos, most, `≤ ${T.mountedVideos}`)];
  }
  if (suite === "memoire") {
    if (!reference?.heapMb?.end || summary.heapMb?.end == null) return [check("mémoire : référence", false, summary.heapMb?.end, "relevé dev requis")];
    const ratio = Math.round((summary.heapMb.end / reference.heapMb.end) * 100) / 100;
    return [check("mémoire : tas JS face à dev", ratio <= T.heapGrowth, ratio, `≤ ×${T.heapGrowth}`)];
  }
  const out = [];
  for (const x of summary) {
    if (x.ui) {
      out.push(check(`${x.label} : i/s UI`, x.ui.fps60 >= T.uiFps, x.ui.fps60, `≥ ${T.uiFps}`));
      out.push(check(`${x.label} : pire image UI`, x.ui.worstMs <= T.worstFrameMs, x.ui.worstMs, `≤ ${T.worstFrameMs} ms`));
    }
    // Une pastille, un raccourci du rail, une tuile de bibliothèque : pas un titre, pas d'aperçu à attendre.
    if (x.fondSetMs !== undefined && !NOT_A_TITLE.test(x.endFocus ?? "")) {
      out.push(fondCheck(x, T));
      out.push(check(`${x.label} : 1re image vidéo`, x.videoMs != null && x.videoMs <= T.videoMs, x.videoMs, `≤ ${T.videoMs} ms`));
      out.push(check(`${x.label} : saut`, Boolean(x.jumps) && !x.jumps.jumped, x.jumps?.maxStepPt ?? null, `≤ ${T.jumpPt} pt par image`));
    }
  }
  return out;
}
