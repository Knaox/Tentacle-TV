/**
 * La LECTURE de la fin d'un média : où commence le générique, et quelles scènes
 * le suivent. L'entrée des deux modules d'à côté — `tailSkeleton.ts` pour
 * l'ossature, `tailScenes.ts` pour les scènes — et la seule fonction que
 * l'analyse appelle.
 *
 * `null` veut dire « rien de sûr » : ni défilement, ni marqueur de fournisseur.
 * On ne fabrique alors rien, et rien n'est rangé en base.
 */

import { findCreditsStart, findSkeleton } from "./tailSkeleton";
import { findScenes, type TailScene } from "./tailScenes";
import { Timeline, type TailInput } from "./tailTimeline";

export type { TailScene } from "./tailScenes";
export type { TailInput } from "./tailTimeline";

export interface TailReading {
  /** Le début du générique : le film s'arrête là. */
  creditsStartMs: number;
  /** Les scènes après ce début (mi- et post-génériques), triées. */
  scenes: TailScene[];
  /** Le défilement vu à l'image, `null` s'il n'y en a pas eu. */
  crawl: [number, number] | null;
  /** L'audio a-t-il été écouté ? Sans lui, seules les preuves d'image comptent. */
  audio: boolean;
}

export function readTail(input: TailInput): TailReading | null {
  const timeline = new Timeline(input);
  const skeleton = findSkeleton(timeline);
  const start = findCreditsStart(timeline, skeleton);
  if (start === null) return null;
  const scenes = findScenes(timeline, skeleton, start);
  return { creditsStartMs: start.ms, scenes, crawl: skeleton.crawl, audio: timeline.hasAudio };
}
