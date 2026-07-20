/**
 * IPC de lecture locale : résolution de source (fichier revérifié côté Rust)
 * et progression locale par utilisateur (+ file de resynchro hors ligne).
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../hooks/mpvRuntime";

export interface LocalSubtitleFile {
  absolutePath: string;
  fileName: string;
}

export interface LocalSource {
  fileId: number;
  variant: "original" | "light";
  absolutePath: string;
  subtitleFiles: LocalSubtitleFile[];
  positionTicks: number;
  played: boolean;
  autoDeleteAfterWatch: boolean;
  /** Méta dénormalisée — lecteur présentable en démarrage 100 % hors ligne. */
  title: string | null;
  seriesName: string | null;
  runtimeTicks: number | null;
  /** Numéros de saison/épisode : sous-titre du lecteur sans DTO serveur. */
  indexNumber: number | null;
  parentIndexNumber: number | null;
  /** Bibliothèque de l'item (préférences de pistes hors ligne). */
  libraryId: string | null;
}

export async function localSourceForItem(
  userId: string,
  itemId: string,
): Promise<LocalSource | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<LocalSource | null>("downloads_local_source", { userId, itemId });
  } catch {
    return null;
  }
}

export async function saveLocalPlaybackState(
  userId: string,
  itemId: string,
  positionTicks: number,
  played: boolean,
  queueForSync: boolean,
): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_playback_set", { userId, itemId, positionTicks, played, queueForSync });
  } catch {
    /* best-effort */
  }
}

export interface PendingReport {
  id: number;
  itemId: string;
  positionTicks: number;
  played: boolean;
  occurredAtUtc: number;
}

/** File de resynchronisation, dédupliquée (dernier état par item). */
export async function pendingReports(userId: string): Promise<PendingReport[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<PendingReport[]>("downloads_reports_pending", { userId });
  } catch {
    return [];
  }
}

export async function markReportSynced(
  userId: string,
  itemId: string,
  upToId: number,
): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_reports_mark_synced", { userId, itemId, upToId });
  } catch {
    /* best-effort : restera en file, retenté au prochain retour en ligne */
  }
}

/**
 * Retire un item de la file de resynchronisation — à appeler quand sa position
 * a déjà été portée à Jellyfin par une autre voie (`/Sessions/Playing/Stopped`
 * d'une fermeture propre). Sans cela, l'entrée serait rejouée au prochain
 * lancement et pourrait écraser une progression faite entre-temps sur un autre
 * appareil.
 */
export async function clearReportQueueForItem(userId: string, itemId: string): Promise<void> {
  if (!isTauri()) return;
  const pending = await pendingReports(userId);
  const entry = pending.find((r) => r.itemId === itemId);
  if (entry) await markReportSynced(userId, itemId, entry.id);
}
