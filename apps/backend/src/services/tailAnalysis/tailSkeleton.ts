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
 * marqueur avant le défilement, s'il n'est pas du film : quarante secondes de
 * parole sans le moindre texte à l'écran, c'est la fin du film, pas des crédits
 * illustrés (« Deadpool », 99:53 : le baiser final). Jamais un marqueur plus
 * ancien que celui qu'on vient d'écarter.
 *
 * Ensuite, en REMONTANT depuis le défilement : tout ce qui est carton, texte,
 * aplat ou noir appartient au générique ; une plage d'image parlée ne l'arrête
 * pas si d'autres crédits la précèdent — c'est une scène mi-générique prise en
 * sandwich (« Palm Springs » : « réalisé par », la scène, les cartons, le
 * défilement). Six minutes au plus.
 */

import { illustratedCredits } from "./tailIllustrated";
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
const FILM_CHECK_MS = 40_000;
const FILM_SPEECH_MIN = 0.5;
const SANDWICH_SPEECH_MIN = 0.4;
const SANDWICH_SCENE_MAX_MS = 300_000;
/** Un bloc plus court ne rejoint le défilement qu'à travers du noir, jamais à travers de l'image. */
const SMALL_BLOCK_MS = 60_000;
/** Un marqueur à moins de ça du début d'un bloc du défilement tombe « au début » de ce bloc. */
const PROVIDER_AT_BLOCK_MS = 20_000;
/** Un chapitre nommé « générique » à plus de ça après le générique illustré le dément. */
const NAMED_CHAPTER_SLACK_MS = 30_000;
/** On écoute depuis un peu avant le premier indice de générique. */
const AUDIO_LEAD_MS = 60_000;
const AUDIO_START_RATIO = 0.55;


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

/** Où commencer à écouter, ou `null` quand rien n'annonce de générique. */
export function audioWindowStart(skeleton: Skeleton, runtimeMs: number): number | null {
  const { crawl, candidates } = skeleton;
  if (crawl === null && candidates.length === 0) return null;
  let first = Math.min(...candidates, crawl ? crawl[0] : Infinity);
  if (crawl) first = Math.min(first, crawl[0] - 300_000);
  return Math.floor(Math.max(AUDIO_START_RATIO * runtimeMs, first - AUDIO_LEAD_MS) / 1000) * 1000;
}

export interface CreditsStart {
  ms: number;
  /** Le début vient d'un marqueur de fournisseur (et peut encore reculer d'une scène). */
  fromProvider: boolean;
  /** La scène mi-générique que le générique illustré a révélée (`tailIllustrated.ts`). */
  sceneMs?: number;
}

export function findCreditsStart(t: Timeline, skeleton: Skeleton): CreditsStart | null {
  const { crawl, candidates, blockStarts } = skeleton;
  const atBlock = candidates.filter((p) => blockStarts.slice(1).some((b) => Math.abs(b - p) <= PROVIDER_AT_BLOCK_MS));
  if (atBlock.length > 0) return { ms: atBlock[atBlock.length - 1], fromProvider: true };
  let start: CreditsStart | null = null;
  const before = candidates.filter((p) => crawl === null || p <= crawl[0]);
  if (before.length > 0) {
    const p = before[before.length - 1];
    if (!isFilm(t, p)) start = { ms: p, fromProvider: true };
  }
  if (crawl !== null && (start === null || start.ms >= crawl[0] - 30_000)) {
    if (start === null) start = { ms: crawl[0], fromProvider: false };
    const found = walkBackCredits(t, crawl[0]);
    if (found !== null && found < start.ms) start = { ms: found, fromProvider: false };
    const illustrated = illustratedCredits(t, crawl[0]);
    // Un chapitre nommé « générique » posé plus tard dément le générique illustré : la
    // musique était la fin du film (« L'Incroyable Hulk », Bruce qui médite, puis Stark au bar).
    const named = t.input.providerSpans.some(
      (s) => s.named === true && illustrated !== null && s.startMs > illustrated.startMs + NAMED_CHAPTER_SLACK_MS,
    );
    if (illustrated !== null && !named && illustrated.startMs < start.ms) {
      start = { ms: illustrated.startMs, fromProvider: false, sceneMs: illustrated.sceneMs };
    }
  }
  if (start === null && candidates.length > 0) start = { ms: candidates[candidates.length - 1], fromProvider: true };
  return start;
}

/** Quarante secondes de parole sans le moindre texte à l'écran après `p` : c'est du film. */
function isFilm(t: Timeline, p: number): boolean {
  const cells = t.cellsBetween(p, p + FILM_CHECK_MS);
  return t.share(p, p + FILM_CHECK_MS, "S") >= FILM_SPEECH_MIN && count(cells, "TLCU") === 0;
}

/**
 * Le premier marqueur de fournisseur d'avant le défilement qui tombe dans le film : le
 * verdict devra le démentir, même sans scène (« Baby Driver » : un générique posé en pleine
 * fin de film ; « Les Indestructibles » : un marqueur dans la dernière scène, un second au
 * vrai début du générique).
 */
export function filmMarker(t: Timeline, skeleton: Skeleton): number | null {
  const { crawl, candidates } = skeleton;
  return candidates.find((p) => (crawl === null || p <= crawl[0]) && isFilm(t, p)) ?? null;
}

/** La première vignette de crédits en remontant depuis le défilement (voir l'en-tête). */
function walkBackCredits(t: Timeline, crawlStart: number): number | null {
  const limit = Math.max(crawlStart - PRE_CRAWL_MS, t.firstCellMs);
  let ms = crawlStart - t.step;
  let best: number | null = null;
  while (ms >= limit) {
    const c = t.cell(ms);
    if (isCredits(c) || c === "K") {
      if (c !== "K") best = ms;
      ms -= t.step;
      continue;
    }
    let from = ms;
    while (from - t.step >= limit && "ED".includes(t.cell(from - t.step))) from -= t.step;
    const creditsBefore = from - t.step >= limit && isCredits(t.cell(from - t.step));
    const sceneLike =
      best !== null &&
      creditsBefore &&
      ms + t.step - from <= SANDWICH_SCENE_MAX_MS &&
      t.share(from, ms + t.step, "S") >= SANDWICH_SPEECH_MIN;
    if (!sceneLike) break;
    ms = from - t.step;
  }
  return best;
}
