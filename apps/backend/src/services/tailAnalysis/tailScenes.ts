/**
 * Les SCÈNES d'après le début du générique — mi-génériques et post-génériques.
 *
 * Deux preuves, et chacune a ses faux amis :
 *
 *  1. **la parole** (une plage `S` d'au moins 15 s) hors du texte : les
 *     chansons du générique en fabriquent (le rap de « Deadpool », les voix de
 *     « Joker »), d'où les gardes — assez d'image (`E`/`D`) sous la plage, pas
 *     de défilement dessous, et avant le défilement, soit une minute de
 *     générique d'abord, soit des cartons vus ;
 *  2. **l'image après le défilement** — une plage `E`/`D` : la scène muette du
 *     shawarma (« Avengers »), la scène musicale de « Pirates des Caraïbes 3 ».
 *     Ses faux amis sont les LOGOS de fin : une plage musicale collée au bout
 *     du fichier et courte (château Disney, lampe Pixar) n'est pas une scène.
 *     Et une plage qui commence en musique pour finir en paroles, c'est la fin
 *     du générique illustré puis la scène : celle-ci commence avec la parole
 *     (« Spy x Family » S1E7 : l'ending animé, puis la scène d'après).
 *
 * Et une troisième : une plage d'image d'au moins 40 s prise ENTRE deux
 * vignettes de générique sombre — des cartons, la scène, le défilement — et
 * parlée. Parlée, parce qu'une plage d'image MUSICALE entre deux crédits est un
 * montage du générique, pas une scène (« Les Gardiens de la Galaxie 3 »,
 * 145:40 ; « Zootopie 2 », 99:00) ; sans audio, on ne tranche pas, on se tait.
 *
 * Le générique court d'un épisode, enfin, se protège de ses propres chansons :
 * dans un générique de fournisseur de moins de trois minutes qui court jusqu'au
 * bout, une plage « parlée » n'est une scène qu'après des cartons ou un
 * défilement sur fond sombre (« Rick et Morty » : les cartons, puis le gag).
 * Sinon, ce sont les voix de l'ending (« Frieren », « Spy x Family »).
 *
 * Les bords : une scène commence au plus tôt à la dernière vignette de
 * crédits qui la précède (arriver tôt coûte quelques secondes de générique,
 * arriver tard ampute la scène) — trente secondes de recul au plus, recalé sur
 * la grille des vignettes. Une scène qui sort du noir commence avec sa parole,
 * quand la vignette noire qui la précède parle déjà (l'œuf de Yoshi de « Super
 * Mario Bros », deux secondes après la dernière ligne du défilement).
 */

import { isEndLogo } from "./tailLogos";
import type { CreditsStart, Skeleton } from "./tailSkeleton";
import { Timeline, count } from "./tailTimeline";

export interface TailScene {
  startMs: number;
  endMs: number;
}

const SCENE_MIN_MS = 15_000;
const TEXT_UNDER_SCENE_MAX = 0.5;
const PICTURE_UNDER_SCENE_MIN = 0.5;
/** Avant le défilement, une scène vient après une minute de générique… */
const CREDITS_BEFORE_SCENE_MS = 60_000;
/** … ou 30 s quand aucun défilement n'a été vu. */
const CREDITS_BEFORE_SCENE_NO_CRAWL_MS = 30_000;
const PROVIDER_TOO_EARLY_MS = 20_000;
/** La parole d'une scène révélée par le générique illustré tombe à une vignette près de son début. */
const REVEALED_SCENE_SLACK_MS = 30_000;
const EDGE_EXTEND_MS = 30_000;
/** Le recul franchit au plus une vignette de musique (voir `earliestStart`). */
const EDGE_MUSIC_MIN = 0.6;
const EDGE_MUSIC_CELLS = 1;
const LOGO_MAX_MS = 55_000;
const LOGO_NEAR_END_MS = 20_000;
const LONG_MUSIC_MS = 150_000;
const MERGE_GAP_MS = 15_000;
const MERGE_GAP_NO_CREDITS_MS = 30_000;
const SANDWICH_MIN_MS = 40_000;
const SANDWICH_SPEECH_MIN = 0.4;
/** Une plage d'image courte ne compte que parlée : sinon, un carton ou un logo. */
const SHORT_SCENE_MS = 30_000;
const SHORT_SCENE_SPEECH_MIN = 0.3;
/** Une plage d'image qui s'ouvre sur au moins ça de musique avant la parole : du générique illustré d'abord. */
const LEAD_MUSIC_MIN_MS = 30_000;
const LEAD_MUSIC_SHARE = 0.6;
/** … et qui S'OUVRE en musique : les vingt premières secondes, aux trois quarts. */
const OPENING_MS = 20_000;
const OPENING_MUSIC_SHARE = 0.75;
/** Un bloc muet de cette durée au plus, qui court jusqu'au bout du fichier : un carton, pas une scène. */
const QUIET_CARD_MAX_MS = 20_000;
/** Un générique de fournisseur plus court, qui court jusqu'au bout : l'ending d'un épisode. */
const SHORT_CREDITS_MAX_MS = 180_000;
const SHORT_CREDITS_END_SLACK_MS = 15_000;

/** Les scènes, triées et fusionnées. `start.ms` peut avancer (marqueur tombé dans le film). */
export function findScenes(t: Timeline, skeleton: Skeleton, start: CreditsStart): TailScene[] {
  const scenes = [...speechScenes(t, skeleton, start), ...sandwichScenes(t, skeleton, start), ...pictureScenes(t, skeleton)];
  scenes.sort((a, b) => a.startMs - b.startMs);
  const merged: TailScene[] = [];
  for (const s of scenes) {
    const last = merged[merged.length - 1];
    const gap = last ? s.startMs - last.endMs : Infinity;
    const creditsBetween = last ? count(t.cellsBetween(last.endMs, s.startMs), "TLCU") > 0 : true;
    if (last && (gap <= MERGE_GAP_MS || (gap <= MERGE_GAP_NO_CREDITS_MS && !creditsBetween))) {
      last.endMs = Math.max(last.endMs, s.endMs);
    } else {
      merged.push({ ...s });
    }
  }
  // Un logo de fin n'est pas une scène, quoi que la parole ou l'image en aient dit (`tailLogos.ts`).
  return merged.filter((s) => s.startMs >= start.ms && !isEndLogo(t, s.startMs, s.endMs));
}

/** Le générique court d'un fournisseur qui court jusqu'au bout — l'ending d'un épisode. */
function shortProviderCredits(t: Timeline): [number, number] | null {
  let found: [number, number] | null = null;
  for (const span of t.input.providerSpans) {
    const long = span.endMs - span.startMs > SHORT_CREDITS_MAX_MS;
    if (long || span.endMs < t.runtimeMs - SHORT_CREDITS_END_SLACK_MS) continue;
    if (found === null || span.startMs > found[0]) found = [span.startMs, span.endMs];
  }
  return found;
}

function speechScenes(t: Timeline, skeleton: Skeleton, start: CreditsStart): TailScene[] {
  const { crawl } = skeleton;
  const shortCredits = shortProviderCredits(t);
  const scenes: TailScene[] = [];
  for (const [runStart, runEnd, kind] of t.soundRuns()) {
    if (kind !== "S" || runEnd - runStart < SCENE_MIN_MS || runEnd <= start.ms) continue;
    const a = Math.max(runStart, start.ms);
    const b = runEnd;
    const inCrawl = crawl !== null && a >= crawl[0] && a < crawl[1];
    const cells = t.cellsBetween(a, b);
    const inner = cells.length > 2 ? cells.slice(1, -1) : cells;
    if (inner.length > 0 && count(inner, "TLC") / inner.length > TEXT_UNDER_SCENE_MAX) continue;
    // Dans l'ending d'un épisode, la parole ne compte qu'après des cartons sur noir.
    if (shortCredits !== null && a >= shortCredits[0] && count(t.cellsBetween(shortCredits[0], a), "TC") < 2) continue;
    if (cells.length > 0 && count(cells, "ED") / cells.length < PICTURE_UNDER_SCENE_MIN) continue;
    // Dans le défilement, l'image doit l'emporter : une chanson sur des cartons (« Joker ») parle aussi.
    if (inCrawl && count(cells, "ED") <= count(cells, "TLC")) continue;
    const beforeCrawl = crawl === null || a < crawl[0];
    if (beforeCrawl && !inCrawl) {
      // La parole colle au marqueur : il tombait dans la fin du film.
      if (start.fromProvider && a - start.ms <= PROVIDER_TOO_EARLY_MS && scenes.length === 0) {
        start.ms = b;
        continue;
      }
      const creditsSeen = count(t.cellsBetween(start.ms, a), "TLCU");
      const need = crawl !== null ? CREDITS_BEFORE_SCENE_MS : CREDITS_BEFORE_SCENE_NO_CRAWL_MS;
      // La scène que le générique illustré a révélée n'a pas à le prouver une seconde fois.
      const revealed = start.sceneMs !== undefined && Math.abs(a - start.sceneMs) <= REVEALED_SCENE_SLACK_MS;
      if (!revealed && a - start.ms < need && creditsSeen < 2) continue;
    }
    if (t.runtimeMs - a < 10_000) continue;
    if (t.runtimeMs - b <= 10_000 && b - a < 25_000 && count(t.cellsBetween(a, b), "E") < 2) continue;
    scenes.push({ startMs: earliestStart(t, a, start.ms), endMs: latestEnd(t, b) });
  }
  return scenes;
}

/**
 * Le début d'une scène, reculé jusqu'à la dernière vignette de générique et recalé sur la
 * grille — à travers une vignette de musique au plus : une scène peut s'ouvrir sur quelques
 * secondes de musique avant la première réplique (« Twilight 4 »), mais au-delà c'est la
 * chanson du générique illustré (« Fast X » : le bouton menait 42 s avant la scène).
 */
function earliestStart(t: Timeline, a: number, creditsStartMs: number): number {
  const floor = Math.max(creditsStartMs + 20_000, a - EDGE_EXTEND_MS);
  const musical = (ms: number): boolean => t.share(ms, ms + t.step, "M") >= EDGE_MUSIC_MIN;
  let music = 0;
  const picture = (ms: number): boolean => "ED".includes(t.cell(ms)) && (!musical(ms) || music++ < EDGE_MUSIC_CELLS);
  let s = a;
  while (s - t.step >= floor && picture(s - t.step)) s -= t.step;
  const cellStart = t.firstCellMs + Math.floor((s - t.firstCellMs) / t.step) * t.step;
  return cellStart >= floor && "ED".includes(t.cell(cellStart)) && (cellStart === s || !musical(cellStart) || music < EDGE_MUSIC_CELLS) ? cellStart : s;
}

function latestEnd(t: Timeline, b: number): number {
  let e = b;
  while (e < Math.min(t.runtimeMs, b + EDGE_EXTEND_MS) && "ED".includes(t.cell(e))) e += t.step;
  return Math.min(e, t.runtimeMs);
}

/**
 * Une plage d'image PARLÉE prise entre deux vignettes de générique SOMBRE
 * (cartons ou défilement sur noir), du début du générique à la fin du
 * défilement. Les aplats et le texte clair ne comptent pas comme bords : un
 * défilement sur fond texturé (« Cars 3 ») alterne texte et image sans
 * qu'aucune scène n'y vive.
 */
function sandwichScenes(t: Timeline, skeleton: Skeleton, start: CreditsStart): TailScene[] {
  const { crawl } = skeleton;
  if (crawl === null) return [];
  const scenes: TailScene[] = [];
  let ms = start.ms;
  while (ms < crawl[1]) {
    if (!"ED".includes(t.cell(ms))) {
      ms += t.step;
      continue;
    }
    let end = ms;
    while (end < crawl[1] && "ED".includes(t.cell(end))) end += t.step;
    const before = t.cell(ms - t.step);
    const after = t.cell(end);
    const spoken = t.share(ms, end, "S") >= SANDWICH_SPEECH_MIN;
    if (end - ms >= SANDWICH_MIN_MS && "TC".includes(before) && "TCK".includes(after) && spoken) {
      scenes.push({ startMs: ms, endMs: end });
    }
    ms = end;
  }
  return scenes;
}

function pictureScenes(t: Timeline, skeleton: Skeleton): TailScene[] {
  const { crawl } = skeleton;
  if (crawl === null) return [];
  const scenes: TailScene[] = [];
  let ms = crawl[1];
  while (ms < t.runtimeMs) {
    if (!"ED".includes(t.cell(ms))) {
      ms += t.step;
      continue;
    }
    let end = ms;
    while (end < t.runtimeMs && "ED".includes(t.cell(end))) end += t.step;
    end = Math.min(end, t.runtimeMs);
    const start = spokenTail(t, ms, end);
    if (isScene(t, start, end)) scenes.push({ startMs: start === ms ? outOfBlack(t, ms) : start, endMs: end });
    ms = end;
  }
  return scenes;
}

/** Le début de la scène d'une plage qui s'ouvre en musique : la première parole de la dernière plage parlée. */
function spokenTail(t: Timeline, from: number, to: number): number {
  if (!t.hasAudio) return from;
  let s = to;
  while (s - t.step >= from && t.share(s - t.step, s, "S") >= 0.5) s -= t.step;
  if (s - from < LEAD_MUSIC_MIN_MS || to - s < SCENE_MIN_MS || t.share(from, s, "M") < LEAD_MUSIC_SHARE) return from;
  // Une scène peut porter de la musique en son milieu (« Rick et Morty » S1E10) : on ne coupe que ce qui s'ouvre en musique.
  if (t.share(from, from + OPENING_MS, "M") < OPENING_MUSIC_SHARE) return from;
  let first = s - t.step;
  while (first < s && t.sound(first) !== "S") first += 1000;
  return first;
}

/** Le début d'une scène qui sort du noir : la seconde où l'on parle dans la vignette noire d'avant. */
function outOfBlack(t: Timeline, ms: number): number {
  const before = ms - t.step;
  if (t.cell(before) !== "K" || t.share(before, ms, "S") < 0.5) return ms;
  let s = before;
  while (s < ms && t.sound(s) !== "S") s += 1000;
  return s;
}

function isScene(t: Timeline, from: number, to: number): boolean {
  const duration = to - from;
  if (duration < SCENE_MIN_MS) return false;
  const brightCells = count(t.cellsBetween(from, to), "E");
  const nearEnd = t.runtimeMs - to <= LOGO_NEAR_END_MS;
  if (!t.hasAudio) return !(duration < SHORT_SCENE_MS && brightCells < 2) && !(nearEnd && duration <= 60_000);
  const speech = t.share(from, to, "S");
  const music = t.share(from, to, "M");
  const quiet = t.share(from, to, "Q");
  // Court et sombre : il faut qu'on y parle (« Harry Potter 2 », la vitrine de Lockhart).
  if (duration < SHORT_SCENE_MS && brightCells < 2 && speech < SHORT_SCENE_SPEECH_MIN) return false;
  const logo = nearEnd && duration <= LOGO_MAX_MS && music >= 0.4 && speech < 0.4;
  // Une scène finit sur un noir ou un dernier carton ; un logo muet court jusqu'au dernier instant.
  const lastInstant = t.runtimeMs - to < t.step;
  const quietCard = quiet >= 0.5 && speech < 0.15 && (duration < 20_000 || (lastInstant && duration <= QUIET_CARD_MAX_MS));
  const shortMusic = music >= 0.5 && speech < 0.15 && duration <= 30_000;
  const colourfulCrawl = music >= 0.6 && duration > LONG_MUSIC_MS;
  return !logo && !quietCard && !shortMusic && !colourfulCrawl;
}
