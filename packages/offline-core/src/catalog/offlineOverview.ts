/**
 * La synthèse de l'écran de gestion hors ligne — commune au bureau et au
 * téléphone : ce qui est prêt, ce qui transite, ce qui a échoué, et où en est
 * la file dans son ensemble.
 *
 * Pure : l'avancement EN DIRECT (magasin de progression) est injecté par
 * `live`, pour que la barre globale avance au même rythme que celles des
 * lignes, sans attendre la prochaine relecture de la base.
 */

import type { DownloadStatus } from "../core/store";

/** Le strict nécessaire d'une entrée de la liste pour la résumer. */
export interface OverviewEntry {
  id: number;
  status: DownloadStatus;
  bytesDone: number;
  expectedSize: number | null;
  pausedByUser?: boolean;
}

export interface LiveReading {
  bytesDone: number;
  expectedSize: number | null;
}

export interface OfflineOverview {
  /** Titres prêts, lisibles sans réseau. */
  ready: number;
  /** Octets occupés par les titres prêts. */
  readyBytes: number;
  /** En file ou en cours de transfert. */
  running: number;
  /** En pause (explicite ou système). */
  paused: number;
  /** Pauses explicites — seules celles-là appellent « Tout reprendre ». */
  heldByUser: number;
  /** En erreur, à réessayer. */
  errors: number;
  /** Octets reçus sur les transferts dont la taille finale est connue. */
  transferDone: number;
  /** Taille finale attendue des mêmes transferts. */
  transferTotal: number;
  /**
   * Avancement global, entre 0 et 1 — `null` quand aucun transfert n'annonce
   * sa taille : une barre inventée mentirait sur l'avancement.
   */
  transferRatio: number | null;
}

const IN_FLIGHT = new Set<DownloadStatus>(["queued", "downloading", "paused", "error"]);

export function summarizeOffline(
  entries: readonly OverviewEntry[],
  live: (fileId: number) => LiveReading | undefined = () => undefined,
): OfflineOverview {
  const out: OfflineOverview = {
    ready: 0,
    readyBytes: 0,
    running: 0,
    paused: 0,
    heldByUser: 0,
    errors: 0,
    transferDone: 0,
    transferTotal: 0,
    transferRatio: null,
  };
  for (const entry of entries) {
    switch (entry.status) {
      case "complete":
        out.ready += 1;
        out.readyBytes += entry.bytesDone;
        continue;
      case "queued":
      case "downloading":
        out.running += 1;
        break;
      case "paused":
        out.paused += 1;
        if (entry.pausedByUser === true) out.heldByUser += 1;
        break;
      case "error":
        out.errors += 1;
        break;
      default:
        break;
    }
    if (!IN_FLIGHT.has(entry.status)) continue;
    const reading = live(entry.id);
    const expected = reading?.expectedSize ?? entry.expectedSize;
    // Sans taille finale, l'entrée ne peut pas peser dans un pourcentage.
    if (expected === null || expected <= 0) continue;
    const done = Math.min(expected, reading?.bytesDone ?? entry.bytesDone);
    out.transferDone += done;
    out.transferTotal += expected;
  }
  if (out.transferTotal > 0) out.transferRatio = out.transferDone / out.transferTotal;
  return out;
}

/** Octets occupés par un groupe d'entrées prêtes (l'en-tête d'une série). */
export function readyBytesOf(entries: readonly OverviewEntry[]): number {
  let total = 0;
  for (const entry of entries) if (entry.status === "complete") total += entry.bytesDone;
  return total;
}
