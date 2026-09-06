/**
 * La façade UNIQUE de l'interface vers le moteur hors ligne — l'équivalent
 * mobile des commandes IPC du bureau (`ipc/downloads*.ts`), en appels directs
 * et synchrones : la base et le moteur vivent dans le même processus.
 *
 * Tout ce que les écrans font au hors ligne passe par ici : lister, garder,
 * mettre en pause, reprendre, annuler, retirer, régler l'auto-suppression,
 * lire l'espace, résoudre une source locale, enregistrer une progression,
 * lire une ressource du snapshot. Rien d'autre n'importe le cœur.
 */

import {
  deleteClaim,
  diskUsage,
  enqueueBatch,
  episodeNumbers,
  freeSpace,
  listForUser,
  localSource,
  normalizeEnqueueItem,
  purgeDueClaims,
  restartPlayback,
  scheduleOnPlayed,
  setAutoDelete,
  setPlaybackState,
  stateForItem,
  type DeleteOutcome,
  type DownloadListEntry,
  type EnqueueItemInput,
  type EnqueueOutcome,
  type LocalSource,
} from "@tentacle-tv/offline-core";
import { clearProgress } from "@tentacle-tv/offline-core/react";
import { localDb } from "./database";
import { notifyOfflineChanged, offlineEngine } from "./engineRuntime";
import { expoFileStore } from "./expoFileStore";
import { localResourceUri } from "./localUri";
import { offlineVolume } from "./volume";

/** Une entrée telle que les écrans la consomment (nom du cœur conservé en alias). */
export type OfflineEntry = DownloadListEntry;
export type { DeleteOutcome, EnqueueItemInput, EnqueueOutcome, LocalSource };

/** Marge d'espace libre sur un téléphone : 750 Mio (2 Gio sur un ordinateur). */
export const OFFLINE_SPACE_MARGIN_BYTES = 750 * 1024 * 1024;

export interface DiskInfo {
  freeBytes: number;
  usedBytes: number;
}

/** Une source locale, avec son URI `file://` sous le nom que le lecteur attend. */
export interface OfflineLocalSource extends LocalSource {
  fileUri: string;
  subtitleUris: Array<{ uri: string; fileName: string }>;
}

/**
 * Rattrapage des numéros d'épisode : une fois par session, à la première
 * liste demandée — il lit les `item.json` du disque, donc opérant même au
 * démarrage cent pour cent hors ligne.
 */
let backfillDone = false;

export function listOfflineEntries(userId: string): OfflineEntry[] {
  const db = localDb();
  if (!backfillDone) {
    backfillDone = true;
    try {
      episodeNumbers.backfill(db, offlineVolume());
    } catch {
      // Racine indisponible : les numéros manqueront, la liste sera là.
    }
  }
  return listForUser(db, userId);
}

export function offlineStateForItem(userId: string, itemId: string): OfflineEntry | null {
  return stateForItem(localDb(), userId, itemId);
}

/** Met le lot en file — ou le refuse en bloc faute de place — puis relance le moteur. */
export function keepOffline(userId: string, items: readonly EnqueueItemInput[]): EnqueueOutcome {
  const engine = offlineEngine();
  const outcome = enqueueBatch(
    localDb(),
    userId,
    items.map(normalizeEnqueueItem),
    freeSpace(offlineVolume()),
    Date.now(),
    OFFLINE_SPACE_MARGIN_BYTES,
  );
  if (outcome.accepted) {
    // En données mobiles avec « Wi-Fi seulement », le `pump` refuse : le lot
    // attend le Wi-Fi dès la mise en file (pause système), au lieu de partir
    // puis d'être coupé.
    engine.pump();
    engine.notifyChanged();
  }
  return outcome;
}

export function pauseTransfer(fileId: number): void {
  offlineEngine().pause(fileId);
}

export function resumeTransfer(fileId: number): void {
  offlineEngine().resume(fileId);
}

export function cancelTransfer(fileId: number): void {
  offlineEngine().cancel(fileId);
  clearProgress(fileId);
}

/** Retire le claim de ce compte ; le fichier part avec le dernier claim. */
export async function removeOfflineEntry(userId: string, fileId: number): Promise<DeleteOutcome> {
  const engine = offlineEngine();
  // Un transfert qui écrit encore ferait réapparaître le fichier après sa
  // suppression : on l'annule et on attend sa sortie effective.
  if (engine.isActive(fileId)) {
    engine.cancel(fileId);
    await engine.waitNotActive(fileId, 5_000);
  }
  const outcome = deleteClaim(localDb(), offlineVolume(), userId, fileId);
  clearProgress(fileId);
  engine.notifyChanged();
  return outcome;
}

export function setAutoDeleteAfterWatch(userId: string, fileId: number, enabled: boolean, delayMinutes: number): void {
  setAutoDelete(localDb(), userId, fileId, enabled, delayMinutes, Date.now());
  notifyOfflineChanged();
}

export function offlineDiskInfo(): DiskInfo {
  return { freeBytes: freeSpace(offlineVolume()), usedBytes: diskUsage(localDb()) };
}

/** Meilleur fichier local LISIBLE pour ce compte et ce titre — revérifié sur le disque. */
export function localSourceForItem(userId: string, itemId: string): OfflineLocalSource | null {
  const source = localSource(localDb(), offlineVolume(), userId, itemId, Date.now());
  if (source === null) return null;
  return {
    ...source,
    fileUri: source.absolutePath,
    subtitleUris: source.subtitleFiles.map((file) => ({ uri: file.absolutePath, fileName: file.fileName })),
  };
}

/** Progression locale ; l'échéance d'auto-suppression est posée ici même. */
export function savePlaybackState(
  userId: string,
  itemId: string,
  positionTicks: number,
  played: boolean,
  queueForSync: boolean,
): void {
  const db = localDb();
  const now = Date.now();
  setPlaybackState(db, userId, itemId, positionTicks, played, queueForSync, now);
  scheduleOnPlayed(db, userId, itemId, now);
}

export function restartLocalPlayback(userId: string, itemId: string): void {
  restartPlayback(localDb(), userId, itemId, Date.now());
}

/**
 * Le rond « vu » des fiches locales. Marquer vu = une lecture complète (mise en
 * file pour le serveur, auto-suppression armée) ; marquer non vu = repartir de
 * zéro, en local seulement — Jellyfin ne reçoit jamais un « non vu » par la
 * file de resynchronisation.
 */
export function setLocalWatched(userId: string, itemId: string, played: boolean): void {
  if (played) savePlaybackState(userId, itemId, 0, true, true);
  else restartLocalPlayback(userId, itemId);
  notifyOfflineChanged();
}

/** Purge à la demande ; `exemptItemId` = le titre en cours de lecture. */
export function purgeDue(exemptItemId: string | null = null): number {
  const purged = purgeDueClaims(localDb(), offlineVolume(), Date.now(), exemptItemId);
  if (purged > 0) notifyOfflineChanged();
  return purged;
}

/** URI d'une ressource du snapshot (`item.json`, `primary.jpg`, `segments.json`…). */
export function metaUri(itemId: string, fileName: string): string {
  return localResourceUri(`meta/${itemId}/${fileName}`);
}

export function localExists(uri: string): boolean {
  return expoFileStore.exists(uri);
}

export function readLocalText(uri: string): string | null {
  try {
    return expoFileStore.readText(uri);
  } catch {
    return null;
  }
}

export function readLocalJson<T>(uri: string): T | null {
  const text = readLocalText(uri);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
