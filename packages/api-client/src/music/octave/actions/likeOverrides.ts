/**
 * Octave — le cœur AFFICHÉ tout de suite : un geste pose son état ici, avant
 * la réponse du serveur ou de l'extension ; la donnée relue (ou
 * `music:userdata`) le confirme et l'efface. Un refus le retire.
 */

import { useSyncExternalStore } from "react";

type Overrides = ReadonlyMap<string, boolean>;

let overrides: Overrides = new Map();
const listeners = new Set<() => void>();

function emit(next: Overrides): void {
  overrides = next;
  for (const l of listeners) l();
}

export function setLikeOverride(key: string, liked: boolean): void {
  const next = new Map(overrides);
  next.set(key, liked);
  emit(next);
}

export function clearLikeOverride(key: string): void {
  if (!overrides.has(key)) return;
  const next = new Map(overrides);
  next.delete(key);
  emit(next);
}

export function likeOverrideOf(key: string): boolean | undefined {
  return overrides.get(key);
}

export function resetLikeOverrides(): void {
  if (overrides.size) emit(new Map());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Le cœur d'un titre : le geste en cours, sinon la donnée. */
export function useLiked(key: string, fromData: boolean): boolean {
  const read = () => overrides.get(key);
  const override = useSyncExternalStore(subscribe, read, read);
  return override ?? fromData;
}
