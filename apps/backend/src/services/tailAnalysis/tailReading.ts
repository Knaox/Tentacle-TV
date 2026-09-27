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
import { findPreview } from "./tailPreview";
import { findScenes, type TailScene } from "./tailScenes";
import { Timeline, type TailInput } from "./tailTimeline";

export type { TailScene } from "./tailScenes";
export type { TailInput } from "./tailTimeline";

/** Une scène qui commence au plus ça avant l'aperçu (recul du début compris) n'est que lui. */
const PREVIEW_SCENE_SLACK_MS = 40_000;

export interface TailReading {
  /** Le début du générique : le film s'arrête là. */
  creditsStartMs: number;
  /** Les scènes après ce début (mi- et post-génériques), triées. */
  scenes: TailScene[];
  /** Le défilement vu à l'image, `null` s'il n'y en a pas eu. */
  crawl: [number, number] | null;
  /** L'audio a-t-il été écouté ? Sans lui, seules les preuves d'image comptent. */
  audio: boolean;
  /** L'aperçu du prochain épisode qui clôt le fichier (`tailPreview.ts`). */
  preview?: [number, number];
}

export function readTail(input: TailInput): TailReading | null {
  const timeline = new Timeline(input);
  const skeleton = findSkeleton(timeline);
  const start = findCreditsStart(timeline, skeleton);
  if (start === null) return null;
  const preview = findPreview(timeline, start.ms);
  // L'aperçu n'est pas une scène — ni ce que la lecture de la parole en a tiré, recul compris.
  const scenes = findScenes(timeline, skeleton, start).filter(
    (s) => preview === null || s.endMs <= preview[0] || s.startMs < preview[0] - PREVIEW_SCENE_SLACK_MS,
  );
  return {
    creditsStartMs: start.ms,
    scenes,
    crawl: skeleton.crawl,
    audio: timeline.hasAudio,
    ...(preview !== null ? { preview } : {}),
  };
}
