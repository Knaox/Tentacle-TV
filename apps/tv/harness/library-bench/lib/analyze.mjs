// L'analyse d'un rapport de la sonde. Ouverture : 1re affiche et premier écran
// complet après la navigation. Défilement : la part du temps où des affiches
// À L'ÉCRAN étaient vides (échantillonnée toutes les 20 ms, à partir de la
// position de la grille et des chargements), la pire attente d'une carte, et
// le délai après l'arrêt jusqu'à ce que toutes les affiches visibles soient là.
import fs from "node:fs";

/** Les intervalles [chargée, démontée) de chaque instance d'affiche, par adresse. */
function imageIntervals(imgs) {
  const instances = new Map();
  for (const [t, kind, id, uri] of imgs) {
    let inst = instances.get(id);
    if (!inst) {
      inst = { uri, load: null, gone: null };
      instances.set(id, inst);
    }
    if (kind === "l" && inst.load === null) inst.load = t;
    if (kind === "x") inst.gone = t;
  }
  const byUri = new Map();
  for (const inst of instances.values()) {
    if (!byUri.has(inst.uri)) byUri.set(inst.uri, []);
    byUri.get(inst.uri).push(inst);
  }
  return byUri;
}
const shownAt = (intervals, t) => !!intervals && intervals.some((i) => i.load !== null && i.load <= t && (i.gone === null || i.gone > t));
const worstOf = (long) => long.map((l) => l[1]).sort((a, b) => b - a).slice(0, 5);

/** La hauteur de l'écran de l'Apple TV, en points. */
const SCREEN = 1080;
const STEP = 20;

export function analyze(rep, kind = "hold") {
  const res = {
    label: rep.label,
    ui: rep.ui && { fps60: rep.ui.fps60, dropped: rep.ui.dropped, hitches: rep.ui.hitches, seconds: rep.ui.seconds, worst: worstOf(rep.ui.long) },
    js: rep.js && { fps60: rep.js.fps60, dropped: rep.js.dropped, worst: worstOf(rep.js.long) },
  };
  if (!rep.grid) return { ...res, error: "pas de grille" };
  const byUri = imageIntervals(rep.imgs);
  const cards = rep.cards ?? [];
  const rows = rep.grid.rows; // [haut, hauteur, montée, 1re carte, cartes]
  const lineOfCard = [];
  rows.forEach(([, , , start, count], line) => { for (let c = 0; c < count; c++) lineOfCard[start + c] = line; });
  const visibleCards = (y) => {
    const out = [];
    for (const [top, height, , start, count] of rows) if (top < y + SCREEN && top + height > y) for (let c = 0; c < count; c++) out.push(start + c);
    return out;
  };
  const firstLoad = (uri) => Math.min(...(byUri.get(uri) ?? []).filter((i) => i.load !== null).map((i) => i.load));

  if (kind === "open") {
    const nav = rep.marks.find((m) => m[1].startsWith("nav:Library"));
    const t0 = nav ? nav[0] : rep.armedAt;
    const first = visibleCards(0).filter((c) => c < cards.length);
    const loads = first.map((c) => firstLoad(cards[c]));
    return { ...res, firstPosterMs: Math.round(Math.min(...loads) - t0), screenCompleteMs: Math.round(Math.max(...loads) - t0), visibleCards: first.length };
  }

  // Défilement : la liste qui a défilé en dernier (la grille).
  const listId = rep.scroll[rep.scroll.length - 1]?.[1];
  const scroll = rep.scroll.filter((s) => s[1] === listId);
  if (scroll.length < 2) return { ...res, error: "pas de défilement" };
  const tStart = scroll[0][0];
  const moving = scroll.filter((s, i) => i === 0 || s[2] !== scroll[i - 1][2]);
  const tStop = moving[moving.length - 1][0];
  const yAt = (t) => {
    let y = scroll[0][2];
    for (const s of scroll) {
      if (s[0] > t) break;
      y = s[2];
    }
    return y;
  };
  const loadedLines = (t) => {
    let n = rows.length;
    for (const d of rep.data ?? []) if (d[1] === listId && d[0] <= t) n = d[2];
    return n;
  };
  let visibleMs = 0;
  let blankMs = 0;
  let worstBlank = 0;
  const blankRun = new Map();
  for (let t = tStart; t <= tStop; t += STEP) {
    const y = yAt(t);
    const lines = loadedLines(t);
    for (const c of visibleCards(y)) {
      visibleMs += STEP;
      const shown = lineOfCard[c] < lines && c < cards.length && shownAt(byUri.get(cards[c]), t);
      const run = shown ? 0 : (blankRun.get(c) ?? 0) + STEP;
      blankRun.set(c, run);
      if (!shown) blankMs += STEP;
      worstBlank = Math.max(worstBlank, run);
    }
  }
  // Après l'arrêt : le temps jusqu'à ce que toutes les affiches visibles soient là.
  const yEnd = scroll[scroll.length - 1][2];
  let settle = 0;
  for (const c of visibleCards(yEnd)) {
    const loads = (byUri.get(cards[c]) ?? []).filter((i) => i.load !== null && i.gone === null).map((i) => i.load);
    settle = Math.max(settle, (loads.length ? Math.min(...loads) : Infinity) - tStop);
  }
  const rowAt = (y) => rows.findIndex(([top, height]) => top + height > y + 200);
  return {
    ...res,
    seconds: Math.round(tStop - tStart) / 1000,
    rowsMoved: rowAt(yEnd) - rowAt(scroll[0][2]),
    blankRatio: visibleMs ? Math.round((1000 * blankMs) / visibleMs) / 10 : 0,
    worstBlankMs: worstBlank,
    settleAfterStopMs: Number.isFinite(settle) ? Math.max(0, Math.round(settle)) : null,
    linesLoaded: rows.length,
  };
}

/** Un relevé de RAM (`tools/ramsampler.py`) : départ, pic, fin, en Mo. */
export function ramSummary(file) {
  const rows = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => l.split(",").map(Number));
  const mb = (b) => Math.round(b / 1048576);
  const fp = rows.map((r) => r[1]);
  return { samples: rows.length, startMB: mb(fp[0]), peakMB: mb(Math.max(...fp)), endMB: mb(fp[fp.length - 1]) };
}

/** Un profil Hermes (CDP `Profiler.stop`) : temps occupé, et fonctions par temps propre / inclusif. */
export function summarizeProfile(prof, top = 25) {
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = (n) => `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber}`;
  const idle = (k) => k.startsWith("[root]") || k.startsWith("(idle)");
  const self = new Map();
  const total = new Map();
  let wall = 0;
  prof.samples.forEach((id, i) => {
    const dt = (prof.timeDeltas?.[i] ?? 0) / 1000;
    wall += dt;
    const k = name(byId.get(id));
    self.set(k, (self.get(k) ?? 0) + dt);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const kk = name(byId.get(cur));
      if (seen.has(kk)) continue;
      seen.add(kk);
      total.set(kk, (total.get(kk) ?? 0) + dt);
    }
  });
  const fmt = (m) => [...m.entries()].filter(([k]) => !idle(k)).sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `${Math.round(v)} ms  ${k}`);
  const idleMs = [...self.entries()].filter(([k]) => idle(k)).reduce((a, [, v]) => a + v, 0);
  return { wallMs: Math.round(wall), busyMs: Math.round(wall - idleMs), self: fmt(self), total: fmt(total) };
}
