/**
 * LA fenêtre de segment — le prédicat qui existait en cinq copies (web,
 * bureau, mobile, deux fois TV), chacune avec sa variante. Une seule règle
 * désormais, testée : on est « dans » un segment de son début jusqu'à une
 * seconde avant sa fin, et seulement une fois la lecture VRAIMENT démarrée
 * (les intros commencent à 0 : sans cette garde, la pilule s'affichait sur
 * l'écran de chargement et le saut partait avant la première image).
 */

import { findSegment, type ResolvedSegment, type SegmentType } from "./segmentTypes";

/**
 * La fenêtre se ferme UNE SECONDE avant la fin du segment : la position est
 * échantillonnée à gros grain (1 Hz web/TV) et un bouton encore affiché à
 * l'instant où la lecture sort d'elle-même du segment sauterait dans le vide.
 */
export const WINDOW_TAIL_MS = 1_000;

export interface SegmentWindowInput {
  segment: ResolvedSegment | null | undefined;
  positionMs: number;
  /** La lecture a réellement commencé (première image rendue). */
  hasStarted: boolean;
}

export function isInSegmentWindow({ segment, positionMs, hasStarted }: SegmentWindowInput): boolean {
  if (!hasStarted || !segment) return false;
  return positionMs >= segment.startMs && positionMs < segment.endMs - WINDOW_TAIL_MS;
}

/**
 * Ordre de préséance quand deux fenêtres se chevauchent : ce qui se passe
 * MAINTENANT à l'écran l'emporte sur ce qui conclut (un récap collé à
 * l'intro, une intro qui mord sur un générique de fin d'un épisode précédent).
 */
const ACTIVE_PRIORITY: readonly SegmentType[] = ["Recap", "Intro", "Commercial", "Preview", "Outro"];

/** Le segment actif à cette position, ou null. */
export function findActiveSegment(
  segments: readonly ResolvedSegment[],
  positionMs: number,
  hasStarted: boolean,
): ResolvedSegment | null {
  for (const type of ACTIVE_PRIORITY) {
    const segment = findSegment(segments, type);
    if (isInSegmentWindow({ segment, positionMs, hasStarted })) return segment;
  }
  return null;
}

export type PlaybackPhase = "IDLE" | "RECAP" | "INTRO" | "CONTENT" | "OUTRO" | "POST_CREDITS";

/** La phase de lecture, dérivée — utile au diagnostic et aux bancs. */
export function playbackPhase(
  segments: readonly ResolvedSegment[],
  positionMs: number,
  hasStarted: boolean,
): PlaybackPhase {
  if (!hasStarted) return "IDLE";
  const actif = findActiveSegment(segments, positionMs, hasStarted);
  if (actif?.type === "Recap") return "RECAP";
  if (actif?.type === "Intro") return "INTRO";
  if (actif?.type === "Outro") return "OUTRO";
  const outro = findSegment(segments, "Outro");
  if (outro && outro.hasContentAfter && positionMs >= outro.endMs) return "POST_CREDITS";
  return "CONTENT";
}
