/**
 * L'OSSATURE du générique : où défile le texte, et où le générique commence.
 *
 * # Le défilement
 *
 * Les blocs de vignettes de texte — défilement `T`, texte clair `L`, cartons sur
 * noir `C` ; une vignette étrangère ou du noir ne coupent pas un bloc — longs
 * d'au moins 20 s et portant au moins deux vignettes de texte : les cartons d'un
 * générique d'épisode (« Rick et Morty », vingt secondes sur noir) en sont un.
 * Le corps du générique est le DERNIER bloc, s'il finit à moins de cinq
 * minutes du bout, plus les blocs qui le précèdent de près — moins de 90 s
 * d'IMAGE entre eux, ou moins de cinq minutes s'ils sont longs et denses. Ce
 * garde-fou est payé : une ville de nuit (« Iron Man 2 », 111:40, lumières
 * piquées sur du noir) forme un bloc de texte de 70 s, vingt-cinq minutes avant
 * le vrai défilement ; l'agréger posait le générique en plein troisième acte.
 * Le noir, lui, ne sépare rien : un défilement trop fin pour les vignettes
 * (« Parasite », trois minutes de noir entre les cartons et la fin) reste du
 * générique. Mais un bloc court ne le rejoint pas à travers de l'image : la
 * ville de nuit qui clôt « The Amazing Spider-Man » (127:00, trente secondes)
 * précède les cartons de vingt secondes de plan sombre. Et un bloc de texte
 * CLAIR seul ne rejoint jamais le défilement : le montage en musique qui clôt
 * un épisode animé en est un (« Rick et Morty » S1E6, 18:00).
 *
 * # Le début du générique
 *
 * D'abord un marqueur de fournisseur qui tombe au début d'un bloc du
 * défilement : les blocs d'avant étaient du texte de l'épisode (« Jujutsu
 * Kaisen » S1E3 : un carton à 20:30, le générique à 21:16). Sinon le DERNIER
 * marqueur avant le défilement.
 *
 * Ensuite, en REMONTANT depuis le défilement : tout ce qui est carton, texte,
 * aplat ou noir appartient au générique, jusqu'à la première image. Six
 * minutes au plus. (Le son, qui disait la fin du film, le générique illustré
 * et les scènes prises en sandwich, n'est plus écouté : l'analyse audio est
 * retirée.)
 */

import { Timeline, count, isCredits, isText } from "./tailTimeline";

const TEXT_BLOCK_MIN_MS = 20_000;
const TEXT_BLOCK_MIN_CELLS = 2;
const CRAWL_TAIL_MAX_MS = 300_000;
const CRAWL_GAP_MAX_MS = 300_000;
const CRAWL_SMALL_GAP_MS = 90_000;
const CRAWL_BIG_BLOCK_MS = 90_000;
const CRAWL_BIG_DENSITY = 0.85;
/** Le défilement ne commence pas avant 60 % du média. */
const CRAWL_START_RATIO = 0.6;
/** Un marqueur de fournisseur ne compte qu'après la moitié du média. */
const PROVIDER_RATIO = 0.5;
/** Les crédits illustrés d'avant le défilement durent rarement plus. */
const PRE_CRAWL_MS = 360_000;
/** Un bloc plus court ne rejoint le défilement qu'à travers du noir, jamais à travers de l'image. */
const SMALL_BLOCK_MS = 60_000;
/** Un marqueur à moins de ça du début d'un bloc du défilement tombe « au début » de ce bloc. */
const PROVIDER_AT_BLOCK_MS = 20_000;
/** Un marqueur d'avant le défilement mais à moins de ça de lui cède à la remontée des crédits. */
const PROVIDER_NEAR_CRAWL_MS = 30_000;

export interface Skeleton {
  /** Le défilement [début, fin), `null` quand aucun texte ne défile. */
  crawl: [number, number] | null;
  /** Les débuts des blocs de texte réunis dans le défilement, croissants. */
  blockStarts: number[];
  /** Les marqueurs de fournisseur plausibles, triés. */
  candidates: number[];
}

interface Block {
  start: number;
  end: number;
  textCells: number;
  /** Les vignettes de texte SOMBRE — défilement, cartons. */
  darkText: number;
}

function textBlocks(t: Timeline): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let miss = 0;
  for (let ms = t.firstCellMs; ms < t.runtimeMs; ms += t.step) {
    const c = t.cell(ms);
    if (c === "?") break;
    if (isText(c)) {
      if (cur === null) cur = { start: ms, end: ms, textCells: 0, darkText: 0 };
      cur.end = ms + t.step;
      cur.textCells++;
      if (c !== "L") cur.darkText++;
      miss = 0;
    } else if (cur !== null) {
      miss++;
      if (miss > 1 && c !== "K") {
        blocks.push(cur);
        cur = null;
        miss = 0;
      }
    }
  }
  if (cur !== null) blocks.push(cur);
  return blocks.filter((b) => b.end - b.start >= TEXT_BLOCK_MIN_MS && b.textCells >= TEXT_BLOCK_MIN_CELLS);
}

export function findSkeleton(t: Timeline): Skeleton {
  const blocks = textBlocks(t);
  let crawl: [number, number] | null = null;
  const blockStarts: number[] = [];
  const last = blocks[blocks.length - 1];
  if (last !== undefined && t.runtimeMs - last.end <= CRAWL_TAIL_MAX_MS) {
    let start = last.start;
    blockStarts.push(start);
    for (let i = blocks.length - 2; i >= 0; i--) {
      const b = blocks[i];
      // L'écart se compte en IMAGE : le noir ne sépare pas deux pans du générique.
      const gap = count(t.cellsBetween(b.end, start), "ED") * t.step;
      const big = b.end - b.start >= CRAWL_BIG_BLOCK_MS && (b.textCells * t.step) / (b.end - b.start) >= CRAWL_BIG_DENSITY;
      if (gap > CRAWL_GAP_MAX_MS || b.start < CRAWL_START_RATIO * t.runtimeMs || (gap > CRAWL_SMALL_GAP_MS && !big)) break;
      if (b.darkText === 0 || (gap > 0 && b.end - b.start < SMALL_BLOCK_MS)) break;
      start = b.start;
      blockStarts.unshift(start);
    }
    crawl = [start, last.end];
  }
  const lo = crawl ? crawl[0] - PRE_CRAWL_MS : PROVIDER_RATIO * t.runtimeMs;
  const hi = crawl ? crawl[0] + 60_000 : t.runtimeMs;
  const candidates = [...new Set(t.input.providerSpans.map((s) => s.startMs))]
    .filter((p) => p >= PROVIDER_RATIO * t.runtimeMs && p >= lo && p <= hi)
    .sort((a, b) => a - b);
  return { crawl, blockStarts, candidates };
}

/**
 * Le début du générique, ou `null` quand rien ne l'annonce (ni défilement, ni
 * marqueur de fournisseur).
 */
export function findCreditsStart(t: Timeline, skeleton: Skeleton): number | null {
  const { crawl, candidates, blockStarts } = skeleton;
  const atBlock = candidates.filter((p) => blockStarts.slice(1).some((b) => Math.abs(b - p) <= PROVIDER_AT_BLOCK_MS));
  if (atBlock.length > 0) return atBlock[atBlock.length - 1];
  const before = candidates.filter((p) => crawl === null || p <= crawl[0]);
  let start = before.length > 0 ? before[before.length - 1] : null;
  if (crawl !== null && (start === null || start >= crawl[0] - PROVIDER_NEAR_CRAWL_MS)) {
    if (start === null) start = crawl[0];
    const found = walkBackCredits(t, crawl[0]);
    if (found !== null && found < start) start = found;
  }
  return start;
}

/** La première vignette de crédits en remontant depuis le défilement (voir l'en-tête). */
function walkBackCredits(t: Timeline, crawlStart: number): number | null {
  const limit = Math.max(crawlStart - PRE_CRAWL_MS, t.firstCellMs);
  let best: number | null = null;
  for (let ms = crawlStart - t.step; ms >= limit; ms -= t.step) {
    const c = t.cell(ms);
    if (!isCredits(c) && c !== "K") break;
    if (c !== "K") best = ms;
  }
  return best;
}
