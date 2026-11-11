/**
 * Ce qu'une transition a montré de PARASITE, compté image par image.
 *
 * Une transition propre va de l'image de départ à l'image d'arrivée sans détour : sa clarté
 * reste entre les deux, et chaque image est au moins aussi proche de l'arrivée que la
 * précédente. Sur les PIXELS (screencast), trois écarts se comptent :
 *
 * - `flash` : une image plus sombre ou plus claire que le départ ET l'arrivée (le « trou » d'un
 *   fondu non complémentaire en sombre, l'éclair en clair) ;
 * - `regress` : une image qui s'ÉLOIGNE de l'arrivée après s'en être approchée (un contenu
 *   paru, disparu, revenu) ;
 * - `blank` : un corps de page uniforme alors que ni le départ ni l'arrivée ne le sont.
 *
 * Sur le DOCUMENT (sonde, lue en fin d'image), quatre autres :
 *
 * - `spinner` : l'anneau d'attente d'une page entière à l'écran ;
 * - `empty` : aucune page visible (ni celle qui sort, ni celle qui entre, ni calque d'ouverture) ;
 * - `navAbsent` : la barre absente ou estompée alors qu'elle est là au départ et à l'arrivée ;
 * - `revert` : une page qui sort et dont l'opacité REMONTE, une page en place dont elle RETOMBE.
 *
 * `heldMs` n'est pas un écart : le temps où la page quittée est restée à l'écran pendant que la
 * suivante se préparait cachée. Trop long, il se lit comme un clic ignoré.
 */

/** Tolérances, en niveaux de clarté (0–255) sur l'image réduite du screencast. */
export const FLASH_TOLERANCE = 3;
export const REGRESS_TOLERANCE = 1.5;
export const BLANK_DEVIATION = 2.5;
/** Un écart d'opacité de moins de 5 % ne se voit pas (et l'arrondi de la sonde est de 1 %). */
export const OPACITY_TOLERANCE = 0.05;

/** La part de l'image sous la barre du haut (68 px sur 900). */
const BODY_FROM = 68 / 900;

function stats(frame, fromRatio = 0, toRatio = 1) {
  const from = Math.floor(frame.height * fromRatio) * frame.width;
  const to = Math.floor(frame.height * toRatio) * frame.width;
  let sum = 0;
  let squares = 0;
  for (let i = from; i < to; i += 1) {
    sum += frame.luma[i];
    squares += frame.luma[i] * frame.luma[i];
  }
  const count = to - from;
  const mean = sum / count;
  return { mean, deviation: Math.sqrt(Math.max(0, squares / count - mean * mean)) };
}

function distance(a, b) {
  if (a.luma.length !== b.luma.length) return Number.NaN;
  let sum = 0;
  for (let i = 0; i < a.luma.length; i += 1) sum += Math.abs(a.luma[i] - b.luma[i]);
  return sum / a.luma.length;
}

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Les écarts du DOCUMENT, d'après les images de la sonde prises après le geste. */
export function analyseProbe(seen) {
  const frames = seen.filter((f) => !f.error);
  if (frames.length === 0) return { frames: 0, spinner: 0, empty: 0, navAbsent: 0, revert: 0, faded: 0, heldMs: 0 };
  const navAtEnds = frames[0].nav >= 0.99 && frames[frames.length - 1].nav >= 0.99;
  let leavingLow = 1;
  let stayingHigh = 0;
  let revert = 0;
  for (const frame of frames) {
    const leaving = frame.pages.filter((p) => p.pinned);
    // Une page tenue cachée n'est pas encore « en place » : elle ne retombe pas, elle n'est pas montrée.
    const staying = frame.pages.filter((p) => !p.pinned && !p.empty && !p.held);
    // Une page neuve qui sort repart de 1 ; une page neuve en place repart de son opacité d'entrée.
    if (leaving.length === 0) leavingLow = 1;
    const leavingNow = leaving.length > 0 ? Math.min(...leaving.map((p) => p.opacity)) : null;
    const stayingNow = staying.length > 0 ? Math.min(...staying.map((p) => p.opacity)) : null;
    if ((leavingNow !== null && leavingNow > leavingLow + OPACITY_TOLERANCE) || (stayingNow !== null && stayingNow < stayingHigh - OPACITY_TOLERANCE)) revert += 1;
    if (leavingNow !== null) leavingLow = Math.min(leavingLow, leavingNow);
    stayingHigh = stayingNow === null ? 0 : Math.max(stayingHigh, stayingNow);
  }
  return {
    frames: frames.length,
    spinner: frames.filter((f) => f.spinners > 0).length,
    empty: frames.filter((f) => f.player === 0 && f.overlay === 0 && !f.pages.some((p) => !p.empty && p.opacity > OPACITY_TOLERANCE)).length,
    navAbsent: navAtEnds ? frames.filter((f) => f.nav < 0.99).length : 0,
    revert,
    /** Non compté : une page en place pas encore à pleine opacité (une ENTRÉE en fondu). */
    faded: frames.filter((f) => f.pages.some((p) => !p.pinned && !p.held && p.opacity < 0.99)).length,
    heldMs: (() => {
      const held = frames.filter((f) => f.pages.some((p) => p.held));
      return held.length > 0 ? Math.round(held[held.length - 1].t - frames[0].t) : 0;
    })(),
  };
}

/**
 * @param {{ gestureAt: number, frames: Array<{ t: number, width: number, height: number, luma: Uint8Array }>, probe: { frames: any[], marks: any[] } }} capture
 */
export function analyseTransition(capture) {
  const { frames, probe } = capture;
  const mark = probe.marks.find((m) => m.label === "pointerdown" || m.label.startsWith("go "));
  const start = mark ? mark.t : capture.gestureAt;
  const before = frames.filter((f) => f.t <= start);
  const after = frames.filter((f) => f.t > start);
  const first = before[before.length - 1] ?? frames[0];
  const last = frames[frames.length - 1];
  const document = analyseProbe(probe.frames.filter((f) => f.t > start));
  if (!first || !last || after.length === 0) return { frames: after.length, error: "aucune image après le geste", parasites: 0, document, rows: [] };

  const firstBody = stats(first, BODY_FROM);
  const lastBody = stats(last, BODY_FROM);
  const low = Math.min(firstBody.mean, lastBody.mean) - FLASH_TOLERANCE;
  const high = Math.max(firstBody.mean, lastBody.mean) + FLASH_TOLERANCE;

  let closest = distance(first, last);
  let lastChange = start;
  let widestGap = 0;
  const rows = [];
  let flash = 0;
  let regress = 0;
  let blank = 0;
  let previous = first;
  for (const frame of after) {
    const body = stats(frame, BODY_FROM);
    const toLast = distance(frame, last);
    const moved = distance(frame, previous);
    const isFlash = body.mean < low || body.mean > high;
    const isRegress = toLast > closest + REGRESS_TOLERANCE;
    const isBlank = body.deviation < BLANK_DEVIATION && firstBody.deviation >= BLANK_DEVIATION * 2 && lastBody.deviation >= BLANK_DEVIATION * 2;
    if (isFlash) flash += 1;
    if (isRegress) regress += 1;
    if (isBlank) blank += 1;
    if (moved > 0.15) {
      // Un grand écart ENTRE deux images qui diffèrent : le screencast en a peut-être sauté.
      widestGap = Math.max(widestGap, frame.t - Math.max(previous.t, start));
      lastChange = frame.t;
    }
    closest = Math.min(closest, toLast);
    rows.push({ ms: Math.round(frame.t - start), luma: round(body.mean), dev: round(body.deviation), toLast: round(toLast), moved: round(moved, 2), flag: `${isFlash ? "F" : ""}${isRegress ? "R" : ""}${isBlank ? "B" : ""}` });
    previous = frame;
  }

  const pixels = rows.filter((r) => r.flag !== "").length;
  return {
    frames: after.length,
    settleMs: Math.round(lastChange - start),
    widestGapMs: Math.round(widestGap),
    lumaFrom: round(firstBody.mean),
    lumaTo: round(lastBody.mean),
    lumaMin: round(Math.min(...rows.map((r) => r.luma))),
    lumaMax: round(Math.max(...rows.map((r) => r.luma))),
    flash,
    regress,
    blank,
    pixels,
    document,
    parasites: pixels + document.spinner + document.empty + document.navAbsent + document.revert,
    rows,
  };
}
