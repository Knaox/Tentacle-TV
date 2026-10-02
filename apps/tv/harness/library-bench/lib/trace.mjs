// L'analyse de la trace image par image (`probe/scrollTrace.js`) : ce que
// l'œil voit pendant un défilement — la vitesse de la page à chaque image du
// fil d'interface, ses accrocs, et ses CREUX (la page qui ralentit alors que
// la flèche est toujours tenue).
//
// Objectif du chantier « défilement » : aucune image au-delà de 33 ms sur le
// fil d'interface, aucune fenêtre de 250 ms sous 55 i/s, aucun creux.

const FRAME = 1000 / 60;

/** Les images de la trace : temps (ms, horloge des images), position de la page (pt). */
export function framesOf(rep) {
  const raw = rep.trace?.frames ?? [];
  return raw
    .filter((f) => f[2] !== null)
    .map(([t, wall, contentY, focusY]) => ({ t, wall, y: -contentY, focusY }));
}

/** La vitesse lissée (pt/s) sur `span` ms autour de chaque image. */
function smoothedSpeed(frames, i, span) {
  let a = i;
  let b = i;
  while (a > 0 && frames[i].t - frames[a - 1].t <= span / 2) a -= 1;
  while (b < frames.length - 1 && frames[b + 1].t - frames[i].t <= span / 2) b += 1;
  const dt = frames[b].t - frames[a].t;
  return dt > 0 ? ((frames[b].y - frames[a].y) * 1000) / dt : 0;
}

/**
 * Le bilan d'une trace : accrocs du fil d'interface (> 25 et > 33 ms), pire
 * fenêtre de 250 ms (i/s), et les creux de vitesse — une baisse sous la moitié
 * du pic atteint depuis le départ, tant que la page n'est pas arrivée.
 */
export function analyzeTrace(rep, { from = -Infinity, to = Infinity } = {}) {
  const frames = framesOf(rep).filter((f) => f.wall >= from && f.wall <= to);
  if (frames.length < 10) return { error: "trace vide" };
  const t0 = frames[0].t;
  const gaps = [];
  for (let i = 1; i < frames.length; i++) gaps.push([frames[i].t - t0, frames[i].t - frames[i - 1].t]);
  const over = (ms) => gaps.filter(([, dt]) => dt > ms);
  let worstWindow = Infinity;
  let worstWindowAt = 0;
  for (let i = 0, j = 0; i < frames.length; i++) {
    while (j < frames.length && frames[j].t - frames[i].t < 250) j += 1;
    if (j >= frames.length) break;
    const fps = ((j - i) * 1000) / 250;
    if (fps < worstWindow) {
      worstWindow = fps;
      worstWindowAt = frames[i].t - t0;
    }
  }
  const moving = frames.map((f, i) => ({ t: f.t - t0, v: smoothedSpeed(frames, i, 100) }));
  return {
    seconds: Math.round(frames[frames.length - 1].t - t0) / 1000,
    frames: frames.length,
    distance: Math.round(frames[frames.length - 1].y - frames[0].y),
    hitches25: over(25).length,
    hitches33: over(33.4).length,
    worstFrameMs: Math.round(Math.max(...gaps.map((g) => g[1]))),
    worstFrames: over(25).map(([t, dt]) => [Math.round(t), Math.round(dt)]).slice(0, 12),
    worst250Fps: Math.round(worstWindow * 10) / 10,
    worst250At: Math.round(worstWindowAt),
    dips: dipsOf(moving),
  };
}

/**
 * Les creux : la vitesse (absolue) passe sous la moitié du pic atteint
 * jusque-là, puis remonte au-dessus de 80 % de ce pic — un ralentissement
 * passager, pas l'arrêt final.
 */
export function dipsOf(moving) {
  const dips = [];
  let peak = 0;
  let dip = null;
  for (const { t, v } of moving) {
    const speed = Math.abs(v);
    if (!dip && peak > 1500 && speed < peak / 2) dip = { at: Math.round(t), peak: Math.round(peak), low: Math.round(speed) };
    if (dip) {
      dip.low = Math.min(dip.low, Math.round(speed));
      if (speed > peak * 0.8) {
        dip.end = Math.round(t);
        dip.ms = dip.end - dip.at;
        dips.push(dip);
        dip = null;
      }
    }
    peak = Math.max(peak, speed);
  }
  return dips;
}

/** La chronologie par tranches de `step` ms : vitesse, i/s, événements du focus, pages, accrocs JS. */
export function timeline(rep, step = 100) {
  const frames = framesOf(rep);
  if (!frames.length) return [];
  const w0 = frames[0].wall;
  const events = rep.trace?.events ?? [];
  const pages = (rep.data ?? []).filter((d) => d[1] === 999);
  const jsLong = (rep.js?.long ?? []).map(([t, dt]) => [rep.armedAt + t, dt]);
  const rows = [];
  for (let a = w0; a < frames[frames.length - 1].wall; a += step) {
    const b = a + step;
    const inside = frames.filter((f) => f.wall >= a && f.wall < b);
    const first = inside[0];
    const last = inside[inside.length - 1];
    const v = inside.length > 1 ? Math.round(((last.y - first.y) * 1000) / (last.t - first.t)) : 0;
    rows.push({
      t: Math.round(a - w0),
      v,
      fps: Math.round((inside.length * 1000) / step),
      y: last ? Math.round(last.y) : null,
      focus: events.filter((e) => e[1] === "focus" && e[0] >= a && e[0] < b).length,
      keys: events.filter((e) => e[1] !== "focus" && e[1] !== "blur" && e[0] >= a && e[0] < b).map((e) => `${e[1]}${e[3] ?? ""}`).join(","),
      page: pages.filter((d) => d[0] >= a && d[0] < b).map((d) => d[2]).join(","),
      jsLong: jsLong.filter(([t]) => t >= a && t < b).map(([, dt]) => dt).join(","),
    });
  }
  return rows;
}

export { FRAME };
