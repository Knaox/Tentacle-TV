import { useSyncExternalStore } from "react";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * La demande de téléchargement partie d'une CARTE, en mémoire.
 *
 * Pourquoi un magasin plutôt qu'un `useState` dans le bouton : les contrôles de
 * survol sont MONTÉS au survol (cf. la section « Coût GPU » de CLAUDE.md), donc
 * DÉMONTÉS dès que le curseur quitte la carte — 200 ms plus tard, exactement le
 * temps d'aller cliquer dans le dialogue. Un dialogue rendu par le bouton
 * disparaîtrait sous la souris. Pire dans le panneau d'aperçu 16:9, qui se
 * ferme lui-même sur `onMouseLeave` et emporterait son portail.
 *
 * La demande vit donc hors de l'arbre des cartes, et `DownloadRequestHost` la
 * rend. Corollaire heureux : un seul dialogue possible à l'écran.
 */

export interface DownloadRequest {
  /**
   * Incrément : redemander le MÊME titre doit rouvrir le dialogue. Sans lui,
   * l'objet serait identique et l'hôte ne rendrait rien.
   */
  seq: number;
  item: MediaItem;
}

let current: DownloadRequest | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((cb) => cb());
}

export function requestDownload(item: MediaItem): void {
  current = { seq: ++seq, item };
  emit();
}

export function clearDownloadRequest(): void {
  if (current === null) return;
  current = null;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function snapshot(): DownloadRequest | null {
  return current;
}

/** La demande en attente d'être résolue puis ouverte, ou `null`. */
export function useDownloadRequest(): DownloadRequest | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
