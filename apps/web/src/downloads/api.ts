/**
 * Wrappers IPC typés du module téléchargements (desktop uniquement).
 * Silencieux hors Tauri : jamais d'erreur visible sur le web.
 * Le front ne voit JAMAIS de SQL ni de chemins absolus construits à la main —
 * uniquement ces commandes et des chemins relatifs servis par
 * `tentacle-local` (voir `localResourceUrl`).
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../hooks/mpvRuntime";

export type SetRootResult =
  | { ok: true; path: string }
  | { ok: false; code: "root-not-empty" | "root-not-writable" | "unknown" };

export async function getDownloadsRoot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string>("downloads_get_root");
  } catch {
    return null;
  }
}

export async function setDownloadsRoot(path: string): Promise<SetRootResult> {
  if (!isTauri()) return { ok: false, code: "unknown" };
  try {
    const normalized = await invoke<string>("downloads_set_root", { path });
    return { ok: true, path: normalized };
  } catch (error) {
    const message = typeof error === "string" ? error : "";
    if (message === "root-not-empty" || message === "root-not-writable") {
      return { ok: false, code: message };
    }
    return { ok: false, code: "unknown" };
  }
}

/** Octets libres sur le volume de la racine de téléchargements. */
export async function getDiskFree(): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<number>("downloads_disk_free");
  } catch {
    return null;
  }
}

/** Octets occupés par les téléchargements (partiels compris). */
export async function getDiskUsage(): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<number>("downloads_disk_usage");
  } catch {
    return null;
  }
}

/* ---- Moteur de téléchargement ---- */

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "complete"
  | "error"
  | "canceled";

export interface DownloadEntry {
  id: number;
  itemId: string;
  mediaSourceId: string;
  variant: "original" | "light";
  preset: string | null;
  relPath: string;
  expectedSize: number | null;
  bytesDone: number;
  status: DownloadStatus;
  errorCode: string | null;
  title: string | null;
  seriesName: string | null;
  kind: "movie" | "episode" | null;
  seriesId: string | null;
  seasonId: string | null;
  /** Épisode : numéros de saison/épisode (regroupement et tri du catalogue). */
  indexNumber: number | null;
  parentIndexNumber: number | null;
  /** Durée de l'item (vignettes d'épisode). */
  runtimeTicks: number | null;
  autoDeleteAfterWatch: boolean;
}

export interface SubtitleSideCarInput {
  index: number;
  format: "srt" | "ass" | "vtt";
  langTag: string;
}

export interface EnqueueItemInput {
  itemId: string;
  mediaSourceId: string;
  variant: "original" | "light";
  preset?: string;
  containerExt: string;
  expectedSize?: number;
  estimatedSize?: number;
  kind: "movie" | "episode";
  seriesId?: string;
  seasonId?: string;
  libraryId?: string;
  runtimeTicks?: number;
  title?: string;
  seriesName?: string;
  indexNumber?: number;
  parentIndexNumber?: number;
  autoDeleteAfterWatch: boolean;
  audioStreamIndex?: number;
  burnSubtitleIndex?: number;
  subtitles?: SubtitleSideCarInput[];
}

export interface EnqueueOutcome {
  accepted: boolean;
  neededBytes: number;
  freeBytes: number;
  fileIds: number[];
}

/** Démarre/rafraîchit le moteur (credentials en mémoire côté Rust, jamais persistés). */
export async function engineStart(serverUrl: string, token: string): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_engine_start", { serverUrl, token });
  } catch {
    /* moteur indisponible : les commandes suivantes échoueront proprement */
  }
}

export async function enqueueDownloads(
  userId: string,
  serverUrl: string,
  token: string,
  items: EnqueueItemInput[],
): Promise<EnqueueOutcome | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<EnqueueOutcome>("downloads_enqueue", { userId, serverUrl, token, items });
  } catch {
    return null;
  }
}

export async function pauseDownload(fileId: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_pause", { fileId });
  } catch { /* no-op */ }
}

export async function resumeDownload(fileId: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_resume", { fileId });
  } catch { /* no-op */ }
}

export async function cancelDownload(fileId: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_cancel", { fileId });
  } catch { /* no-op */ }
}

export interface DeleteOutcome {
  fileDeleted: boolean;
  metaDeleted: boolean;
}

export async function deleteDownload(userId: string, fileId: number): Promise<DeleteOutcome | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<DeleteOutcome>("downloads_delete", { userId, fileId });
  } catch {
    return null;
  }
}

export async function listDownloads(userId: string): Promise<DownloadEntry[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<DownloadEntry[]>("downloads_list", { userId });
  } catch {
    return [];
  }
}

export async function downloadStateForItem(
  userId: string,
  itemId: string,
): Promise<DownloadEntry | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<DownloadEntry | null>("downloads_state_for_item", { userId, itemId });
  } catch {
    return null;
  }
}

export async function setAutoDeleteAfterWatch(
  userId: string,
  fileId: number,
  enabled: boolean,
): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("downloads_set_auto_delete", { userId, fileId, enabled });
  } catch { /* no-op */ }
}

export interface DownloadProgressEvent {
  fileId: number;
  bytesDone: number;
  expectedSize: number | null;
}

/** Abonnement aux changements d'état (invalider les listes). */
export async function onDownloadsChanged(callback: () => void): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen("downloads://changed", callback);
}

/** Abonnement à la progression (throttlée côté Rust, ~2 événements/s). */
export async function onDownloadsProgress(
  callback: (event: DownloadProgressEvent) => void,
): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<DownloadProgressEvent>("downloads://progress", (event) => callback(event.payload));
}
