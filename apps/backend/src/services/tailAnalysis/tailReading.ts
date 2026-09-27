/**
 * La LECTURE de la fin d'un média : où commence le générique, et quelles scènes
 * le suivent. L'entrée des deux modules d'à côté — `tailSkeleton.ts` pour
 * l'ossature, `tailScenes.ts` pour les scènes — et la seule fonction que
 * l'analyse appelle.
 *
 * `null` veut dire « rien de sûr » : ni défilement, ni marqueur de fournisseur.
 * On ne fabrique alors rien, et rien n'est rangé en base.
 */

import { filmMarker, findCreditsStart, findSkeleton } from "./tailSkeleton";
import { findPreview, findPreviewAfterMarker } from "./tailPreview";
import { findScenes, type TailScene } from "./tailScenes";
import { Timeline, type TailInput } from "./tailTimeline";

export type { TailScene } from "./tailScenes";
export type { TailInput } from "./tailTimeline";

/** Une scène qui commence au plus ça avant l'aperçu (recul du début compris) n'est que lui. */
const PREVIEW_SCENE_SLACK_MS = 40_000;
/** Un générique qui commence au moins ça après un marqueur tombé dans le film le dément… */
const OVERRIDE_SLACK_MS = 30_000;
/** … à moins que ce marqueur ne promette une réplique suivie (voir `promisesSpeech`). */
const PROMISE_END_SLACK_MS = 20_000;
const PROMISE_LOOK_MS = 30_000;
const PROMISED_SPEECH_MS = 10_000;

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
  /** Le marqueur du fournisseur tombait dans le film : ses génériques sont à remplacer. */
  overrides?: true;
}

export function readTail(input: TailInput): TailReading | null {
  const timeline = new Timeline(input);
  const skeleton = findSkeleton(timeline);
  let start = findCreditsStart(timeline, skeleton);
  const film = filmMarker(timeline, skeleton);
  let preview = start !== null ? findPreview(timeline, start.ms) : null;
  if (preview === null) {
    // Sans ending : l'aperçu qui suit un marqueur (One Piece, d'Enies Lobby à Wano).
    const after = findPreviewAfterMarker(timeline, input.audio?.fromMs ?? input.cellsFromMs);
    if (after !== null) {
      preview = after.preview;
      // Le marqueur commençait dans l'histoire : le générique commence à sa fin (le carton
      // « To be continued »), ou avec l'aperçu.
      if (start === null || (film !== null && start.ms <= film + OVERRIDE_SLACK_MS)) {
        start = { ms: Math.min(after.markerEndMs, after.preview[0]), fromProvider: false };
      }
    }
  }
  if (start === null) return null;
  // Le marqueur du fournisseur tombait dans le film, et le générique commence bien après lui :
  // le verdict le démentira, même sans scène (« Les Indestructibles », « Baby Driver ») —
  // sauf s'il promet derrière lui une réplique suivie : c'était peut-être une vraie scène que
  // la lecture n'a pas su voir (« La Nonne 2 » : un générique sonorisé, puis les Warren).
  const overrides = film !== null && start.ms > film + OVERRIDE_SLACK_MS && !promisesSpeech(timeline, film, start.ms, preview);
  const p = preview;
  // L'aperçu n'est pas une scène — ni ce que la lecture de la parole en a tiré, recul compris.
  const scenes = findScenes(timeline, skeleton, start).filter(
    (s) => p === null || s.endMs <= p[0] || s.startMs < p[0] - PREVIEW_SCENE_SLACK_MS,
  );
  return {
    creditsStartMs: start.ms,
    scenes,
    crawl: skeleton.crawl,
    audio: timeline.hasAudio,
    ...(p !== null ? { preview: p } : {}),
    ...(overrides ? { overrides: true } : {}),
  };
}

/** Un générique de fournisseur né à `film` promet-il, derrière lui, une réplique suivie (l'aperçu n'en est pas une) ? */
function promisesSpeech(t: Timeline, film: number, creditsStartMs: number, preview: [number, number] | null): boolean {
  return t.input.providerSpans.some((span) => {
    if (span.startMs !== film || span.endMs >= t.knownEndMs - PROMISE_END_SLACK_MS) return false;
    const to = Math.max(creditsStartMs, span.endMs) + PROMISE_LOOK_MS;
    let run = 0;
    for (let s = span.endMs; s < to; s += 1000) {
      const voice = t.sound(s) === "S" && (preview === null || s < preview[0] || s >= preview[1]);
      run = voice ? run + 1000 : 0;
      if (run >= PROMISED_SPEECH_MS) return true;
    }
    return false;
  });
}
