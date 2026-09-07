/**
 * Progression des transferts — external store module-level, alimenté par
 * l'évènement `downloads://progress` du moteur (IPC sur le bureau, appel
 * direct sur le mobile).
 * Évite d'invalider TanStack Query ~2 fois par seconde par transfert : seules
 * les barres abonnées re-rendent.
 */

import { useSyncExternalStore } from "react";

export interface ProgressSnapshot {
  bytesDone: number;
  expectedSize: number | null;
  /** Débit lissé, octets par seconde ; `null` avant le second échantillon. */
  rateBps: number | null;
  /** Temps restant estimé, en ms ; `null` sans total ou sans débit. */
  etaMs: number | null;
}

/**
 * Lissage du débit. Les échantillons arrivent étranglés (4 Mio ou 700 ms) et
 * très irréguliers : une valeur brute sauterait du simple au triple d'une
 * seconde à l'autre. Une moyenne exponentielle donne un chiffre qu'on peut
 * lire — 0,3 garde de la réactivité sans le tremblement.
 */
const SMOOTHING = 0.3;
/** En deçà, l'écart de temps ne mesure rien de fiable. */
const MIN_SAMPLE_MS = 250;

interface Sample {
  bytes: number;
  atMs: number;
  rateBps: number | null;
}

const progressByFile = new Map<number, ProgressSnapshot>();
const samples = new Map<number, Sample>();
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

/**
 * Nouvel avancement : la vue publique en dérive le débit et le temps restant.
 *
 * `nowMs` est injecté pour que le calcul reste vérifiable ; en usage réel,
 * l'appelant passe l'horloge du système.
 */
export function updateProgress(
  fileId: number,
  reading: { bytesDone: number; expectedSize: number | null },
  nowMs: number = Date.now(),
): void {
  const previous = samples.get(fileId);
  let rateBps = previous?.rateBps ?? null;
  const elapsed = previous === undefined ? 0 : nowMs - previous.atMs;
  const gained = previous === undefined ? 0 : reading.bytesDone - previous.bytes;
  // Un recul (reprise repartie de zéro, taille recalée) invalide la mesure.
  if (gained < 0) {
    rateBps = null;
  } else if (previous !== undefined && elapsed >= MIN_SAMPLE_MS) {
    const instant = (gained * 1_000) / elapsed;
    rateBps = rateBps === null ? instant : rateBps + SMOOTHING * (instant - rateBps);
  }
  if (previous === undefined || elapsed >= MIN_SAMPLE_MS || gained < 0) {
    samples.set(fileId, { bytes: reading.bytesDone, atMs: nowMs, rateBps });
  }

  const remaining =
    reading.expectedSize === null ? null : Math.max(0, reading.expectedSize - reading.bytesDone);
  progressByFile.set(fileId, {
    bytesDone: reading.bytesDone,
    expectedSize: reading.expectedSize,
    rateBps,
    etaMs: remaining === null || rateBps === null || rateBps <= 0 ? null : (remaining / rateBps) * 1_000,
  });
  emit();
}

/** Purge (fin/annulation de transfert) — la valeur DB fait foi ensuite. */
export function clearProgress(fileId?: number): void {
  if (fileId === undefined) {
    progressByFile.clear();
    samples.clear();
  } else {
    progressByFile.delete(fileId);
    samples.delete(fileId);
  }
  emit();
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lecture directe, hors React — le banc d'essai et les notifications s'en servent. */
export function getProgressFor(fileId: number): ProgressSnapshot | undefined {
  return progressByFile.get(fileId);
}

export function useFileProgress(fileId: number): ProgressSnapshot | undefined {
  return useSyncExternalStore(
    subscribeProgress,
    () => getProgressFor(fileId),
    () => getProgressFor(fileId),
  );
}
