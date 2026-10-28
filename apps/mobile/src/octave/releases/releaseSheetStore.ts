/**
 * Octave mobile — la feuille « Importer une sortie » ouverte ou non (un magasin minuscule) : l'entrée de la
 * Bibliothèque l'ouvre vide ; le PARTAGE SYSTÈME l'ouvre avec un lien Bandcamp (`autoStart` : le partage EST le
 * geste) ou des fichiers audio — ceux-là s'AJOUTENT à ce que la feuille tient déjà (iOS remet les fichiers un par
 * un), et partent au toucher « Importer ». Chaque demande porte un numéro : l'hôte la prend une fois.
 */

import { useSyncExternalStore } from "react";
import type { PhoneAudioFile } from "./phoneReleaseFiles";

export type ReleaseSheetRequest =
  | { kind: "empty" }
  | { kind: "link"; url: string; autoStart?: boolean }
  | { kind: "files"; files: PhoneAudioFile[] };

let current: ReleaseSheetRequest | null = null;
let version = 0;
/** La demande à appliquer à l'ouverture, prise UNE fois (une feuille rouverte ne relance rien). */
let pendingPrefill: ReleaseSheetRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openReleaseSheet(request: ReleaseSheetRequest = { kind: "empty" }): void {
  current = request;
  if (request.kind !== "empty") pendingPrefill = request.kind === "files" && pendingPrefill?.kind === "files" ? { ...request, files: [...pendingPrefill.files, ...request.files] } : request;
  version++;
  emit();
}

export function closeReleaseSheet(): void {
  if (!current) return;
  current = null;
  emit();
}

export function takeReleasePrefill(): ReleaseSheetRequest | null {
  const value = pendingPrefill;
  pendingPrefill = null;
  return value;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => current;

export const readReleaseSheet = read;

const readVersion = () => (current ? version : -1);

/** Ouverte ou non, et le numéro de la dernière demande (une demande nouvelle, feuille déjà ouverte, se voit). */
export function useReleaseSheet(): { open: boolean; version: number } {
  const v = useSyncExternalStore(subscribe, readVersion, readVersion);
  return { open: v >= 0, version: v };
}
