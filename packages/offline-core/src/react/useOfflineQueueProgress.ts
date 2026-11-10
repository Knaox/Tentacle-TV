/**
 * L'avancement du lot en cours de la file, EN DIRECT — une seule mémoire par
 * processus : l'écran de gestion et le bouton de la barre du haut lisent le
 * même lot, et il survit au changement de page (un lot ouvert sur une page et
 * relu sur une autre garde ses titres finis).
 *
 * La file est celle du compte de l'appareil : un autre compte n'a aucun des
 * identifiants du lot, qui se referme de lui-même.
 */

import { useMemo, useSyncExternalStore } from "react";
import type { OverviewEntry } from "../catalog/offlineOverview";
import { advanceQueueLot, type QueueLot, type QueueLotProgress } from "../catalog/queueLot";
import { getProgressFor, subscribeProgress } from "./progressStore";

let currentLot: QueueLot | null = null;

/** Lit l'avancement sans retenir le lot (instantané de `useSyncExternalStore`). */
function peek(entries: readonly OverviewEntry[]): QueueLotProgress | null {
  return advanceQueueLot(currentLot, entries, getProgressFor).progress;
}

/** Avance le lot et le RETIENT. Idempotent pour une même file : deux lecteurs n'en font qu'un. */
export function readQueueLot(entries: readonly OverviewEntry[]): QueueLotProgress | null {
  const step = advanceQueueLot(currentLot, entries, getProgressFor);
  currentLot = step.lot;
  return step.progress;
}

/** Pour les tests : oublie le lot retenu. */
export function resetQueueLot(): void {
  currentLot = null;
}

export function useOfflineQueueProgress(entries: readonly OverviewEntry[]): QueueLotProgress | null {
  // Clé primitive : la vue n'est recalculée que si le millième, le compte ou
  // le débit (au kilo-octet par seconde) ont bougé.
  const liveKey = useSyncExternalStore(subscribeProgress, () => keyOf(peek(entries)), () => keyOf(peek(entries)));
  // `liveKey` EST la dépendance au magasin de progression.
  return useMemo(() => readQueueLot(entries), [entries, liveKey]);
}

function keyOf(progress: QueueLotProgress | null): string {
  if (progress === null) return "none";
  const ratio = progress.ratio === null ? "-" : Math.round(progress.ratio * 1000);
  const rate = progress.bytesPerSecond === null ? "-" : Math.round(progress.bytesPerSecond / 1024);
  return `${ratio}:${progress.done}/${progress.count}:${rate}`;
}
