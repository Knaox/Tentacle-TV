/**
 * L'avancement d'un LOT de la file hors ligne — « 3 sur 10, 42 % » — commun au
 * bureau et au téléphone.
 *
 * `summarizeOffline` ne voit que ce qui transite : un épisode fini sort de son
 * numérateur ET de son dénominateur, et la barre globale repartait à zéro à
 * chaque épisode d'une saison. Ici, le lot est l'ensemble des titres entrés
 * dans la file depuis qu'elle était vide : un titre fini y RESTE (compté plein)
 * tant qu'il reste quelque chose en route. La file vidée, le lot se referme ;
 * le prochain ajout en ouvre un autre.
 *
 * Pur : l'état d'un lot passe d'un appel au suivant (`previous`), l'avancement
 * en direct est injecté (`live`), comme pour `summarizeOffline`.
 */

import type { OverviewEntry } from "./offlineOverview";

export interface LotLiveReading {
  bytesDone: number;
  expectedSize: number | null;
  /** Débit lissé du transfert, octets par seconde ; `null` s'il n'est pas encore mesuré. */
  rateBps?: number | null;
}

export interface QueueLot {
  /** Identifiants des fichiers du lot, finis compris. */
  members: ReadonlySet<number>;
  /** Plus haut avancement déjà montré pour CES membres — la barre ne recule jamais. */
  peakRatio: number | null;
}

export interface QueueLotProgress {
  /** Titres du lot (N de « n sur N »). */
  count: number;
  /** Titres du lot déjà prêts (n). */
  done: number;
  /** Octets reçus sur le lot, titres finis compris. */
  bytesDone: number;
  /** Taille attendue du lot, sur les titres dont la taille est connue. */
  bytesTotal: number;
  /**
   * Avancement entre 0 et 1, monotone tant que le lot ne change pas de
   * membres ; `null` quand rien ne permet de le mesurer.
   */
  ratio: number | null;
  /** Débit cumulé des transferts en cours ; `null` tant qu'aucun n'est mesuré. */
  bytesPerSecond: number | null;
  /** Temps restant estimé, en secondes ; `null` sans débit ou sans toutes les tailles. */
  etaSeconds: number | null;
}

export interface QueueLotStep {
  lot: QueueLot | null;
  progress: QueueLotProgress | null;
}

const IN_FLIGHT = new Set(["queued", "downloading", "paused", "error"]);

export function advanceQueueLot(
  previous: QueueLot | null,
  entries: readonly OverviewEntry[],
  live: (fileId: number) => LotLiveReading | undefined = () => undefined,
): QueueLotStep {
  const byId = new Map<number, OverviewEntry>();
  for (const entry of entries) byId.set(entry.id, entry);

  const inFlight = entries.filter((entry) => IN_FLIGHT.has(entry.status));
  // Plus rien en route : le lot est terminé, le suivant repartira de zéro.
  if (inFlight.length === 0) return { lot: null, progress: null };

  const members = new Set<number>();
  // Les anciens membres restent tant qu'ils sont prêts ou en route ; annulés
  // ou retirés, ils ne sont plus attendus et quittent le lot.
  for (const id of previous?.members ?? []) {
    const entry = byId.get(id);
    if (entry !== undefined && (entry.status === "complete" || IN_FLIGHT.has(entry.status))) members.add(id);
  }
  for (const entry of inFlight) members.add(entry.id);

  let done = 0;
  let bytesDone = 0;
  let bytesTotal = 0;
  let unitsDone = 0;
  let allSizesKnown = true;
  let rate = 0;
  let rateMeasured = false;
  for (const id of members) {
    const entry = byId.get(id);
    if (entry === undefined) continue;
    if (entry.status === "complete") {
      done += 1;
      unitsDone += 1;
      bytesDone += entry.bytesDone;
      bytesTotal += entry.bytesDone;
      continue;
    }
    const reading = live(id);
    const expected = reading?.expectedSize ?? entry.expectedSize;
    if (entry.status === "downloading" && typeof reading?.rateBps === "number") {
      rate += reading.rateBps;
      rateMeasured = true;
    }
    if (expected === null || expected <= 0) {
      allSizesKnown = false;
      continue;
    }
    const received = Math.min(expected, reading?.bytesDone ?? entry.bytesDone);
    bytesDone += received;
    bytesTotal += expected;
    unitsDone += received / expected;
  }

  // Toutes les tailles connues : l'avancement se lit en octets. Sinon, en
  // titres (un titre sans taille pèse zéro tant qu'il n'est pas fini) — mêler
  // des octets connus à des tailles inconnues gonflerait la barre.
  const measured = allSizesKnown ? (bytesTotal > 0 ? bytesDone / bytesTotal : null) : unitsDone / members.size;
  const sameMembers = previous !== null && sameSet(previous.members, members);
  const peakRatio =
    measured === null
      ? sameMembers ? previous.peakRatio : null
      : sameMembers && previous.peakRatio !== null ? Math.max(previous.peakRatio, measured) : measured;

  const bytesPerSecond = rateMeasured ? rate : null;
  const etaSeconds =
    allSizesKnown && bytesPerSecond !== null && bytesPerSecond > 0
      ? Math.max(0, bytesTotal - bytesDone) / bytesPerSecond
      : null;

  return {
    lot: { members, peakRatio },
    progress: {
      count: members.size,
      done,
      bytesDone,
      bytesTotal,
      ratio: peakRatio === null ? null : Math.min(1, peakRatio),
      bytesPerSecond,
      etaSeconds,
    },
  };
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}
