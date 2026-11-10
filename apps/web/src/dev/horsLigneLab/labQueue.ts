/**
 * Les états de la FILE du labo : un lot de 8 épisodes (« Caminandes · Saison 1 ») à ses
 * différents instants. Les identifiants des fichiers ne changent pas d'un état à l'autre : le lot
 * (`useOfflineQueueProgress`) retient ses membres, et c'est ce qui prouve que le pourcentage ne
 * recule pas quand un épisode se termine.
 */

import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { clearProgress, readQueueLot, resetQueueLot, updateProgress } from "@tentacle-tv/offline-core/react";
import { LAB_SEASON, entryOf, keptLibrary } from "./labData";

export const QUEUE_STATES = ["debut", "fini", "milieu", "pause", "erreur", "echec", "preparation", "repos", "vide"] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

const LOT_ID = 9101;
/** Une horloge fixe pour le débit : 2 s entre deux mesures, 9 Mio/s. */
const T0 = 1_800_000_000_000;
const RATE = 9 * 1024 * 1024;

type Slot = { status: DownloadListEntry["status"]; ratio?: number; phase?: string; errorCode?: string; pausedByUser?: boolean; retryInSeconds?: number };

/** L'état de chacun des 8 épisodes du lot, dans l'ordre. */
function slots(state: QueueState): Slot[] {
  const queued = (n: number): Slot[] => Array.from({ length: n }, () => ({ status: "queued" }));
  const done = (n: number): Slot[] => Array.from({ length: n }, () => ({ status: "complete" }));
  switch (state) {
    case "debut":
      return [{ status: "downloading", ratio: 0.12 }, ...queued(7)];
    case "fini":
      return [...done(1), { status: "downloading", ratio: 0.03 }, ...queued(6)];
    case "milieu":
      return [...done(3), { status: "downloading", ratio: 0.55 }, ...queued(4)];
    case "preparation":
      // Un Allégé que le serveur prépare encore : en transfert, sans un octet reçu.
      return [...done(3), { status: "downloading", phase: "prepare" }, ...queued(4)];
    case "pause":
      return [...done(3), { status: "paused", ratio: 0.55, pausedByUser: true }, ...Array.from({ length: 4 }, (): Slot => ({ status: "paused", pausedByUser: true }))];
    case "erreur":
      return [...done(3), { status: "error", ratio: 0.55, errorCode: "integrity", retryInSeconds: 42 }, { status: "downloading", ratio: 0.2 }, ...queued(3)];
    case "echec":
      return [...done(3), { status: "error", ratio: 0.55, errorCode: "unavailable" }, { status: "error", errorCode: "disk-full" }, ...Array.from({ length: 3 }, (): Slot => ({ status: "error", errorCode: "io" }))];
    default:
      return [];
  }
}

/** Les entrées de la machine dans cet état, et le magasin de progression mis à l'heure. */
export function applyQueueState(state: QueueState, options: { fresh?: boolean } = {}): DownloadListEntry[] {
  if (options.fresh) {
    resetQueueLot();
    // Le lot est né avec ses 8 épisodes en file : un état pris en route (pause, échec) garde
    // ses titres déjà finis, comme dans l'application qui l'a vu naître.
    if (state !== "vide" && state !== "repos" && state !== "debut") readQueueLot(applyQueueState("debut"));
  }
  clearProgress();
  if (state === "vide") return [];
  const kept = keptLibrary();
  const lot = slots(state).map((slot, index) => {
    const item = LAB_SEASON[index];
    if (item === undefined) throw new Error("le lot du labo a 8 épisodes");
    const size = (item.MediaSources?.[0] as { Size?: number } | undefined)?.Size ?? 0;
    const bytes = Math.round(size * (slot.ratio ?? 0));
    const entry = entryOf(item, {
      id: LOT_ID + index, status: slot.status, bytesDone: bytes, errorCode: slot.errorCode ?? null, pausedByUser: slot.pausedByUser,
      nextRetryAt: slot.retryInSeconds ? Date.now() + slot.retryInSeconds * 1_000 : null, ageDays: 0, phase: slot.phase,
      variant: slot.phase === "prepare" ? "light" : "original",
    });
    if (slot.status === "downloading" && slot.phase !== "prepare") {
      // Deux mesures : le magasin en tire un débit, donc un temps restant.
      updateProgress(entry.id, { bytesDone: Math.max(0, bytes - RATE * 2), expectedSize: size }, T0);
      updateProgress(entry.id, { bytesDone: bytes, expectedSize: size }, T0 + 2_000);
    }
    return entry;
  });
  return [...lot, ...kept];
}
