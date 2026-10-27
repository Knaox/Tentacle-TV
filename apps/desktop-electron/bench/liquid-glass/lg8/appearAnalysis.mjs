// L'analyse d'un relevé de `appear.mjs` : la page et le verre natif, forme par forme.
//
// Page : opacité du contenu, décalage vertical de son centre (px CSS) et échelle (largeur
// affichée / largeur au repos) ; `::before` (l'atténuation, la « grisaille » si elle part
// avant le verre). Natif : opacité EN VOL du conteneur, cadre EN VOL du verre (points, axe qui
// monte) ramené au même repère.

const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * La série d'une forme côté natif, à l'écran : `rows` = [t, alpha, dy (px CSS, + = plus bas),
 * échelle] ; `still` : son dernier cadre (le repos).
 * ⚠️ Mesuré : l'animateur d'AppKit fait AVANCER le `frame` d'un verre pendant son animation
 * (il ne pose pas la destination d'un coup) — le repère de repos est donc le DERNIER cadre
 * relevé de la forme, jamais `frame` à l'instant.
 */
function nativeSeries(native, rest, zoom) {
  const rows = [];
  for (const [t, , regions] of native) {
    const r = regions.find((g) => near(g.css.x, rest[0]) && near(g.css.y, rest[1]) && near(g.css.width, rest[2]));
    if (r) rows.push([t, r]);
  }
  const still = rows.at(-1)?.[1].live.frame;
  if (still === undefined) return { still: null, rows: [] };
  const restCenter = still.y + still.height / 2;
  return { still, rows: rows.map(([t, r]) => [t, r.live.containerAlpha, (restCenter - (r.live.frame.y + r.live.frame.height / 2)) / zoom, r.live.frame.width / still.width]) };
}

/** La valeur native à l'instant t (interpolée), `null` hors de la série. */
function at(series, t, k) {
  if (series.length === 0 || t < series[0][0] || t > series.at(-1)[0]) return null;
  let i = series.findIndex((row) => row[0] >= t);
  if (series[i][0] === t || i === 0) return series[i][k];
  const [a, b] = [series[i - 1], series[i]];
  return a[k] + ((b[k] - a[k]) * (t - a[0])) / (b[0] - a[0]);
}

const firstTime = (rows, test) => rows.find(test)?.[0] ?? null;

/**
 * La SORTIE côté natif : les verres que la page a retirés et dont le conteneur s'éteint
 * (`leaving` de l'instantané) — reconnus au centre horizontal de la forme au repos.
 * [t, alpha, dy (px CSS), échelle] ; `still` : le dernier cadre au repos.
 */
function leavingSeries(native, still, zoom, from) {
  if (still === null) return [];
  const cx = still.x + still.width / 2;
  const restCenter = still.y + still.height / 2;
  const out = [];
  for (const [t, , , leaving] of native) {
    if (t < from || !leaving) continue;
    // Un popover rétrécit vers son bouton : son centre glisse — tolérance à la mesure de la forme.
    const g = leaving.find((l) => Math.abs(l.frame.x + l.frame.width / 2 - cx) < still.width * 0.15 && Math.abs(l.frame.width - still.width) < still.width * 0.2);
    if (g) out.push([t, g.containerAlpha, (restCenter - (g.frame.y + g.frame.height / 2)) / zoom, g.frame.width / still.width]);
  }
  return out;
}

/** Plus grand recul d'une série censée croître (ou avancer, `down`) : un clignotement. */
function reversal(values, down) {
  let worst = 0;
  let best = values[0] ?? 0;
  for (const v of values) {
    worst = Math.max(worst, down ? v - best : best - v);
    best = down ? Math.min(best, v) : Math.max(best, v);
  }
  return worst;
}

export function analyse(pageRows, native, zoom, t0) {
  const shapes = new Map();
  for (const [t, list] of pageRows) {
    for (const s of list) {
      const key = s.rest.map((v) => Math.round(v)).join(",");
      if (!shapes.has(key)) shapes.set(key, { cls: s.cls, rest: s.rest, rows: [] });
      const dy = s.seen[1] + s.seen[3] / 2 - (s.rest[1] + s.rest[3] / 2);
      shapes.get(key).rows.push([t, s.opacity, dy, s.seen[2] / s.rest[2], s.dim, s.present]);
    }
  }
  const viewsZero = (after) => native.find(([t, views]) => t >= after && views === 0)?.[0] ?? null;
  const result = [];
  for (const shape of shapes.values()) {
    const shown = nativeSeries(native, shape.rest, zoom);
    const hideAt0 = firstTime(shape.rows.filter((r) => r[0] > t0 + 400), (r) => r[5] === "false");
    const nat = [...shown.rows, ...leavingSeries(native, shown.still, zoom, hideAt0 ?? Infinity)].sort((a, b) => a[0] - b[0]);
    const hideAt = firstTime(shape.rows.filter((r) => r[0] > t0 + 400), (r) => r[5] === "false");
    const enterRows = shape.rows.filter((r) => r[0] >= t0 && (hideAt === null || r[0] < hideAt));
    const exitRows = hideAt === null ? [] : shape.rows.filter((r) => r[0] >= hideAt);
    const dimFinal = Math.max(...enterRows.map((r) => r[4]), 0);
    // Écarts page ↔ natif, à décalage nul et au meilleur décalage (le natif mesuré à l'écran,
    // la page à son image : une image d'écart est attendue).
    const gaps = (lag) => {
      let alpha = 0; let dy = 0; let scale = 0; let ahead = 0; let grey = 0; let n = 0;
      for (const [t, op, pdy, ps, dim] of shape.rows) {
        const a = at(nat, t + lag, 1);
        if (a === null) continue;
        n += 1;
        alpha = Math.max(alpha, Math.abs(op - a));
        dy = Math.max(dy, Math.abs(pdy - at(nat, t + lag, 2)));
        scale = Math.max(scale, Math.abs(ps - at(nat, t + lag, 3)));
        ahead = Math.max(ahead, op - a);
        if (dimFinal > 0.01) grey = Math.max(grey, dim / dimFinal - a);
      }
      return { n, alpha: round(alpha), dyPx: round(dy, 2), scale: round(scale), contentAheadOfGlass: round(ahead), greyAheadOfGlass: round(grey) };
    };
    let best = { lag: 0, ...gaps(0) };
    for (let lag = -48; lag <= 48; lag += 4) {
      const g = gaps(lag);
      if (g.n > 10 && g.alpha < best.alpha) best = { lag, ...g };
    }
    const natEnter = nat.filter((r) => r[0] >= t0 && (hideAt === null || r[0] < hideAt));
    const natExit = hideAt === null ? [] : nat.filter((r) => r[0] >= hideAt);
    const pageGone = firstTime(exitRows, (r) => r[1] < 0.02);
    result.push({
      shape: shape.cls,
      rest: shape.rest.map((v) => Math.round(v)),
      enter: {
        pageStartMs: rel(firstTime(enterRows, (r) => r[1] > 0.02), t0),
        glassStartMs: rel(firstTime(natEnter, (r) => r[1] > 0.02), t0),
        pageDoneMs: rel(firstTime(enterRows, (r) => r[1] > 0.98), t0),
        glassDoneMs: rel(firstTime(natEnter, (r) => r[1] > 0.98), t0),
        reversalPage: round(reversal(enterRows.map((r) => r[1]), false)),
        reversalGlass: round(reversal(natEnter.map((r) => r[1]), false)),
        startDyPx: round(enterRows.find((r) => r[1] > 0.02)?.[2] ?? 0, 2),
      },
      exit: hideAt === null ? null : {
        pageGoneMs: rel(pageGone, hideAt),
        glassGoneMs: rel(firstTime(natExit, (r) => r[1] < 0.02), hideAt),
        reversalPage: round(reversal(exitRows.map((r) => r[1]), true)),
        reversalGlass: round(reversal(natExit.map((r) => r[1]), true)),
      },
      divergence: { atZeroLag: gaps(0), best },
      hideAt,
    });
  }
  const hideAt = Math.min(...result.map((r) => r.hideAt ?? Number.POSITIVE_INFINITY));
  const zero = Number.isFinite(hideAt) ? viewsZero(hideAt) : null;
  const visualGone = Math.max(...result.map((r) => (r.exit?.pageGoneMs ?? 0)));
  return {
    zoom,
    pageFrames: pageRows.length,
    nativeSamples: native.length,
    viewsShown: Math.max(...native.map((r) => r[1])),
    nativeViewsZeroAfterHideMs: zero === null ? null : zero - hideAt,
    nativeViewsZeroAfterVisualEndMs: zero === null ? null : zero - hideAt - visualGone,
    shapes: result,
  };
}

const rel = (t, from) => (t === null ? null : t - from);
