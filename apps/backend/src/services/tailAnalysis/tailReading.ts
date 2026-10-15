/**
 * La LECTURE de la fin d'un média : où commence le générique, et quelles scènes
 * le suivent. L'entrée des deux modules d'à côté — `tailSkeleton.ts` pour
 * l'ossature, `tailScenes.ts` pour les scènes — et la seule fonction que
 * l'analyse appelle. Rien que les vignettes : l'analyse audio est retirée, et
 * avec elle ce que seul le son disait (l'aperçu du prochain épisode, le
 * marqueur de fournisseur tombé dans le film).
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
  /** Les scènes après ce début, triées. */
  scenes: TailScene[];
  /** Le défilement vu à l'image, `null` s'il n'y en a pas eu. */
  crawl: [number, number] | null;
  /** Champ du verdict rangé (`TailVerdict`) : l'audio n'est plus jamais écouté. */
  audio: false;
}

export function readTail(input: TailInput): TailReading | null {
  const timeline = new Timeline(input);
  const skeleton = findSkeleton(timeline);
  const start = findCreditsStart(timeline, skeleton);
  if (start === null) return null;
  return {
    creditsStartMs: start,
    scenes: findScenes(timeline, skeleton, start),
    crawl: skeleton.crawl,
    audio: false,
  };
}
