/**
 * Progression des transferts — external store module-level (patron
 * colorScheme.ts) alimenté par les événements Tauri `downloads://progress`.
 * Évite d'invalider TanStack Query ~2 fois par seconde par transfert : seules
 * les barres abonnées re-rendent.
 */

import { useSyncExternalStore } from "react";

export interface ProgressSnapshot {
  bytesDone: number;
  expectedSize: number | null;
}

const progressByFile = new Map<number, ProgressSnapshot>();
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

export function updateProgress(fileId: number, snapshot: ProgressSnapshot): void {
  progressByFile.set(fileId, snapshot);
  emit();
}

/** Purge (fin/annulation de transfert) — la valeur DB fait foi ensuite. */
export function clearProgress(fileId?: number): void {
  if (fileId === undefined) progressByFile.clear();
  else progressByFile.delete(fileId);
  emit();
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshotFor = (fileId: number): ProgressSnapshot | undefined =>
  progressByFile.get(fileId);

export function useFileProgress(fileId: number): ProgressSnapshot | undefined {
  return useSyncExternalStore(
    subscribeProgress,
    () => getSnapshotFor(fileId),
    () => getSnapshotFor(fileId),
  );
}
