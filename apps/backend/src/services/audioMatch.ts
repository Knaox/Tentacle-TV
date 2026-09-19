/**
 * L'APPARIEMENT de deux fenêtres d'empreintes — pur, sans E/S.
 *
 * # La méthode, mesurée le 19.09.2026
 *
 * Deux épisodes qui partagent un opening portent la même suite de points
 * chromaprint, à un DÉCALAGE près. On vote donc les décalages : chaque paire de
 * points égaux (i dans A, j dans B) vote pour j − i ; le décalage le plus voté
 * est celui du passage commun. On marche ensuite le long de cette diagonale en
 * comptant les points à distance de Hamming ≤ 6 (le seuil d'Intro Skipper), et
 * on découpe les ZONES denses — fenêtre de deux secondes, quatre points sur
 * dix. Sur Re:Zero S4 et One Piece : openings et endings retrouvés à ±5 s,
 * densité 0,95 à 0,99.
 *
 * # Pourquoi une jointure de hachage d'abord
 *
 * Le vote par force brute compare tout à tout : deux fenêtres de dix minutes
 * font 23 millions de paires, un tiers de seconde bloqué — dans le processus
 * qui proxifie les flux des téléviseurs. La jointure sur les égalités EXACTES
 * (une table valeur → positions) coûte quelques millisecondes ; un vrai passage
 * commun en compte des centaines. La force brute reste en repli, par tranches,
 * en rendant la main.
 *
 * # Ce qui matche à tort, et ce qu'on en fait
 *
 * Le silence, le noir, les fondus donnent des suites de valeurs IDENTIQUES,
 * qui matchent à distance zéro n'importe où : on les déclare mortes avant de
 * voter, et une zone doit porter assez de valeurs distinctes. Une valeur
 * trop fréquente ne discrimine rien : elle ne vote plus.
 */

import { POINTS_PER_SECOND } from "./audioFingerprintTool";

/** Distance de Hamming maximale entre deux points « égaux » (Intro Skipper : 6). */
export const MAX_HAMMING = 6;
/** Sous ce nombre de votes, un décalage est du bruit (≈ 5 s alignées). */
export const MIN_VOTES = 40;
/** Combien de décalages on vérifie le long de leur diagonale. */
export const TOP_OFFSETS = 5;
/** La fenêtre de densité et sa part minimale de points appariés. */
export const DENSITY_WINDOW_MS = 2_000;
export const MIN_DENSITY = 0.4;
/** Deux zones séparées de moins que ça n'en font qu'une. */
export const ZONE_GAP_MS = 3_000;
/** Part de valeurs distinctes sous laquelle une zone est du silence apparié. */
export const MIN_DISTINCT_RATIO = 0.4;
/** Autant de valeurs identiques d'affilée (≈ 1 s) : un point mort. */
export const DEAD_RUN_POINTS = 8;
/** Une valeur présente plus souvent que ça dans une fenêtre ne vote plus. */
export const MAX_POSITIONS_PER_VALUE = 64;
/** Lignes de force brute entre deux rendus de main. */
export const ROWS_PER_TICK = 256;

export interface WindowRef {
  points: Uint32Array;
  /** Position dans le média du premier point, en ms. */
  startMs: number;
}

export interface MatchZone {
  aStartMs: number;
  aEndMs: number;
  bStartMs: number;
  bEndMs: number;
  offsetMs: number;
  /** Part des points de la zone appariés à Hamming ≤ 6. */
  density: number;
  /** Part de valeurs distinctes dans la zone — le silence n'en a pas. */
  distinctRatio: number;
  votes: number;
}

export function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0x3f;
}

const msPerPoint = 1000 / POINTS_PER_SECOND;
const pointsFor = (ms: number): number => Math.max(1, Math.round(ms / msPerPoint));

/** 1 pour chaque point pris dans une suite de valeurs identiques (silence, noir). */
export function markDead(points: Uint32Array): Uint8Array {
  const dead = new Uint8Array(points.length);
  let runStart = 0;
  for (let i = 1; i <= points.length; i++) {
    if (i < points.length && points[i] === points[runStart]) continue;
    if (i - runStart >= DEAD_RUN_POINTS) dead.fill(1, runStart, i);
    runStart = i;
  }
  return dead;
}

const yieldToLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Votes par décalage (indice = j − i + a.length), sur les égalités exactes. */
export function voteByHash(a: Uint32Array, b: Uint32Array, deadA: Uint8Array, deadB: Uint8Array): Int32Array {
  const positions = new Map<number, number[]>();
  for (let j = 0; j < b.length; j++) {
    if (deadB[j]) continue;
    const list = positions.get(b[j]);
    if (list === undefined) positions.set(b[j], [j]);
    else list.push(j);
  }
  const votes = new Int32Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    if (deadA[i]) continue;
    const list = positions.get(a[i]);
    if (list === undefined || list.length > MAX_POSITIONS_PER_VALUE) continue;
    for (const j of list) votes[j - i + a.length]++;
  }
  return votes;
}

/** Le repli : tout contre tout à Hamming ≤ 6, en rendant la main par tranches. */
export async function voteByForce(
  a: Uint32Array, b: Uint32Array, deadA: Uint8Array, deadB: Uint8Array,
): Promise<Int32Array> {
  const votes = new Int32Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    if (i % ROWS_PER_TICK === 0) await yieldToLoop();
    if (deadA[i]) continue;
    const ai = a[i];
    for (let j = 0; j < b.length; j++) {
      if (!deadB[j] && popcount32(ai ^ b[j]) <= MAX_HAMMING) votes[j - i + a.length]++;
    }
  }
  return votes;
}

/** Les meilleurs décalages, distincts d'au moins trois points, ≥ `minVotes`. */
export function bestOffsets(votes: Int32Array, base: number, minVotes = MIN_VOTES, top = TOP_OFFSETS): number[] {
  const ranked: Array<[number, number]> = [];
  for (let k = 0; k < votes.length; k++) if (votes[k] >= minVotes) ranked.push([k - base, votes[k]]);
  ranked.sort((x, y) => y[1] - x[1]);
  const picked: number[] = [];
  for (const [offset] of ranked) {
    if (picked.some((p) => Math.abs(p - offset) <= 2)) continue;
    picked.push(offset);
    if (picked.length >= top) break;
  }
  return picked;
}

/** 1 pour chaque point de A apparié à B le long de la diagonale `offset`. */
export function diagonalHits(
  a: Uint32Array, b: Uint32Array, deadA: Uint8Array, deadB: Uint8Array, offset: number,
): Uint8Array {
  const hits = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const j = i + offset;
    if (j < 0 || j >= b.length || deadA[i] || deadB[j]) continue;
    if (popcount32(a[i] ^ b[j]) <= MAX_HAMMING) hits[i] = 1;
  }
  return hits;
}

interface IndexZone {
  start: number;
  end: number;
}

/** Les zones denses (indices de A), trous courts fusionnés, bornes resserrées sur les points appariés. */
export function denseZones(hits: Uint8Array): IndexZone[] {
  const window = pointsFor(DENSITY_WINDOW_MS);
  const needed = Math.ceil(window * MIN_DENSITY);
  const gap = pointsFor(ZONE_GAP_MS);
  const zones: IndexZone[] = [];
  let sum = 0;
  let open: IndexZone | null = null;
  for (let i = 0; i < hits.length; i++) {
    sum += hits[i];
    if (i >= window) sum -= hits[i - window];
    const dense = i >= window - 1 && sum >= needed;
    if (dense) {
      const start = i - window + 1;
      if (open === null) open = { start, end: i + 1 };
      else open.end = i + 1;
    } else if (open !== null && i - open.end >= gap) {
      zones.push(open);
      open = null;
    }
  }
  if (open !== null) zones.push(open);
  // Resserrer sur les points appariés, aux deux bouts.
  return zones
    .map((zone) => {
      let { start, end } = zone;
      while (start < end && hits[start] === 0) start++;
      while (end > start && hits[end - 1] === 0) end--;
      return { start, end };
    })
    .filter((zone) => zone.end > zone.start);
}

function distinctRatio(points: Uint32Array, zone: IndexZone): number {
  const seen = new Set<number>();
  for (let i = zone.start; i < zone.end; i++) seen.add(points[i]);
  return seen.size / (zone.end - zone.start);
}

function density(hits: Uint8Array, zone: IndexZone): number {
  let n = 0;
  for (let i = zone.start; i < zone.end; i++) n += hits[i];
  return n / (zone.end - zone.start);
}

/** Les passages communs à A et B, en ms de chaque média, sans doublons. */
export async function compareWindows(a: WindowRef, b: WindowRef): Promise<MatchZone[]> {
  if (a.points.length === 0 || b.points.length === 0) return [];
  const deadA = markDead(a.points);
  const deadB = markDead(b.points);
  const base = a.points.length;
  let votes = voteByHash(a.points, b.points, deadA, deadB);
  let offsets = bestOffsets(votes, base);
  if (offsets.length === 0) {
    votes = await voteByForce(a.points, b.points, deadA, deadB);
    offsets = bestOffsets(votes, base);
  }

  const found: MatchZone[] = [];
  for (const offset of offsets) {
    const hits = diagonalHits(a.points, b.points, deadA, deadB, offset);
    for (const zone of denseZones(hits)) {
      const d = density(hits, zone);
      const distinct = distinctRatio(a.points, zone);
      if (d < MIN_DENSITY || distinct < MIN_DISTINCT_RATIO) continue;
      found.push({
        aStartMs: Math.round(a.startMs + zone.start * msPerPoint),
        aEndMs: Math.round(a.startMs + zone.end * msPerPoint),
        bStartMs: Math.round(b.startMs + (zone.start + offset) * msPerPoint),
        bEndMs: Math.round(b.startMs + (zone.end + offset) * msPerPoint),
        offsetMs: Math.round(offset * msPerPoint),
        density: d,
        distinctRatio: distinct,
        votes: votes[offset + base],
      });
    }
    await yieldToLoop();
  }

  // Deux décalages voisins décrivent la même zone : on garde la meilleure.
  found.sort((x, y) => y.density * (y.aEndMs - y.aStartMs) - x.density * (x.aEndMs - x.aStartMs));
  const kept: MatchZone[] = [];
  for (const zone of found) {
    const overlaps = kept.some((k) => {
      const inter = Math.min(k.aEndMs, zone.aEndMs) - Math.max(k.aStartMs, zone.aStartMs);
      return inter > 0.5 * Math.min(k.aEndMs - k.aStartMs, zone.aEndMs - zone.aStartMs);
    });
    if (!overlaps) kept.push(zone);
  }
  return kept.sort((x, y) => x.aStartMs - y.aStartMs);
}
