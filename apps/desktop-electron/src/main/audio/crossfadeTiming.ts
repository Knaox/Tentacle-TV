/**
 * Quand lancer le titre qui arrive, d'après ce que l'instance qui joue dit d'elle (`DeckTimeline`). Pur
 * (`crossfadeTiming.test.ts`).
 *
 * Le fondu part à `durée − fondu` dans le titre qui part. On l'ARME quelques secondes avant (`ARM_AHEAD_S`) :
 * la courbe de sortie est posée sur sa chaîne (elle suit le flux, elle n'attend rien), et une minuterie lance
 * le suivant à l'instant voulu, moins le temps qu'une instance en pause met à faire sortir son son. Trop tard
 * (un saut juste avant la fin), le fondu est abandonné pour l'enchaînement ordinaire : jamais une courbe
 * tronquée qui ferait sauter le volume.
 */

import { deriveStatus, durationOf, type EngineFlags, type LiveProps } from "./audioEngineState";
import { offsetOf, type QueueEntry } from "./audioQueue";
import type { DeckTimeline } from "./crossfadeFilter";

/** À moins de cela du départ du fondu, on l'arme. */
export const ARM_AHEAD_S = 2;
/** En deçà, il est trop tard pour fondre : enchaînement ordinaire. */
export const TOO_LATE_S = 0.4;
/** Le temps qu'une instance en pause, déjà chargée, met à faire sortir son son (mesuré au banc : `crossfadeScenarios`). */
export const RESUME_LATENCY_MS = 30;

export type ArmDecision =
  | { kind: "wait" }
  /** Le fondu est armé : courbe de sortie à `startS` (chronologie de l'ENTRÉE mpv), suivant lancé dans `delayMs`. */
  | { kind: "arm"; startS: number; delayMs: number }
  | { kind: "late" };

export function armDecision(tl: DeckTimeline, fadeS: number): ArmDecision {
  // Un fichier qui grandit n'a pas encore de fin sûre : on attend qu'il soit complet.
  if (!tl.playing || tl.durationS === null || !tl.complete) return { kind: "wait" };
  const startS = tl.durationS - fadeS;
  const lead = startS - tl.positionS;
  if (lead > ARM_AHEAD_S) return { kind: "wait" };
  if (lead < TOO_LATE_S) return { kind: "late" };
  return { kind: "arm", startS: startS - tl.offsetS, delayMs: Math.max(0, Math.round(lead * 1000 - RESUME_LATENCY_MS)) };
}

/** La chronologie d'une instance, d'après son entrée en cours et ce que mpv en dit. */
export function deckTimeline(current: QueueEntry | null, props: LiveProps, flags: EngineFlags, positionS: number): DeckTimeline {
  const durationMs = durationOf(current, props);
  const playing = deriveStatus(current, props, flags) === "playing" && props.timePos !== null;
  // La durée que mpv mesure (fichier complet, hors EDL) l'emporte : la fin du fondu tombe sur la VRAIE fin du titre.
  const measured = current?.source.complete === true && offsetOf(current) === 0 ? props.mpvDuration : null;
  const durationS = measured ?? (durationMs === null ? null : durationMs / 1000);
  const loaded = current !== null && !flags.awaitingRestart && flags.error === null;
  return { positionS, offsetS: offsetOf(current), durationS, complete: current?.source.complete ?? false, playing, loaded, ended: flags.ended };
}
