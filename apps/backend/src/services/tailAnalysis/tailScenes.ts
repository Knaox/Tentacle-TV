/**
 * Les SCÈNES d'après le début du générique : celles qui suivent le défilement.
 *
 * La preuve, c'est l'IMAGE après le défilement — une plage `E`/`D` : la scène
 * muette du shawarma (« Avengers »), la scène musicale de « Pirates des Caraïbes
 * 3 ». Ses faux amis sont les LOGOS de fin (château Disney, lampe Pixar), que
 * `tailLogos.ts` reconnaît à l'image, et les plages courtes : une image courte
 * et sombre, ou toute plage d'une minute au plus collée au bout du fichier,
 * n'est pas une scène.
 *
 * Le son, qui révélait les scènes PARLÉES — mi-génériques, prises entre deux
 * crédits, ou sorties du noir avec leur première réplique —, n'est plus
 * écouté : l'analyse audio est retirée. Ce qui n'a pas de défilement derrière
 * lui ne porte donc plus de scène.
 */

import { isEndLogo } from "./tailLogos";
import type { Skeleton } from "./tailSkeleton";
import { Timeline, count } from "./tailTimeline";

export interface TailScene {
  startMs: number;
  endMs: number;
}

const SCENE_MIN_MS = 15_000;
const LOGO_NEAR_END_MS = 20_000;
/** Une plage collée au bout et plus courte : un logo ou un carton, pas une scène. */
const NEAR_END_SCENE_MIN_MS = 60_000;
const MERGE_GAP_MS = 15_000;
const MERGE_GAP_NO_CREDITS_MS = 30_000;
/** Une plage d'image courte et sombre : un carton ou un logo. */
const SHORT_SCENE_MS = 30_000;

/** Les scènes qui suivent `startMs`, triées et fusionnées. */
export function findScenes(t: Timeline, skeleton: Skeleton, startMs: number): TailScene[] {
  const merged: TailScene[] = [];
  for (const s of pictureScenes(t, skeleton)) {
    const last = merged[merged.length - 1];
    const gap = last ? s.startMs - last.endMs : Infinity;
    const creditsBetween = last ? count(t.cellsBetween(last.endMs, s.startMs), "TLCU") > 0 : true;
    if (last && (gap <= MERGE_GAP_MS || (gap <= MERGE_GAP_NO_CREDITS_MS && !creditsBetween))) {
      last.endMs = Math.max(last.endMs, s.endMs);
    } else {
      merged.push({ ...s });
    }
  }
  // Un logo de fin n'est pas une scène, quoi que l'image en ait dit (`tailLogos.ts`).
  return merged.filter((s) => s.startMs >= startMs && !isEndLogo(t, s.startMs, s.endMs));
}

/** Les plages d'image d'après le défilement, dans l'ordre. */
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
    if (isScene(t, ms, end)) scenes.push({ startMs: ms, endMs: end });
    ms = end;
  }
  return scenes;
}

function isScene(t: Timeline, from: number, to: number): boolean {
  const duration = to - from;
  if (duration < SCENE_MIN_MS) return false;
  const brightCells = count(t.cellsBetween(from, to), "E");
  const nearEnd = t.runtimeMs - to <= LOGO_NEAR_END_MS;
  return !(duration < SHORT_SCENE_MS && brightCells < 2) && !(nearEnd && duration <= NEAR_END_SCENE_MIN_MS);
}
