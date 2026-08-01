/**
 * Wrappers IPC typés du module téléchargements (desktop uniquement).
 * Silencieux hors Tauri : jamais d'erreur visible sur le web.
 * Le front ne voit JAMAIS de SQL ni de chemins absolus construits à la main —
 * uniquement ces commandes et des chemins relatifs servis par
 * `tentacle-local` (voir `localResourceUrl`).
 */

import { invoke, listen } from "../desktop/bridge";
import { supportsDownloads } from "../desktop/bridge";

export type SetRootCode = "root-not-empty" | "root-not-writable" | "unknown";

export type SetRootResult =
  | { ok: true; path: string }
  | { ok: false; code: SetRootCode; detail?: string };

const ROOT_CODES = ["root-not-empty", "root-not-writable"] as const;

/**
 * Code d'erreur stable, quelle que soit la coquille.
 *
 * ⚠️ Les deux coquilles ne rejettent PAS la même chose. Tauri rend une chaîne
 * nue (`Err("root-not-empty".into())`), Electron un objet `Error` dont le
 * message est préfixé par le canal :
 *
 *   Error invoking remote method 'tentacle:downloads_set_root': Error: root-not-writable: EPERM D:\Films
 *
 * Ne tester que `typeof error === "string"` — ce que faisait ce fichier, écrit
 * du temps où Tauri était seul — rendait donc TOUJOURS `unknown` sur Electron,
 * et l'interface affichait « ce dossier n'est pas accessible en écriture »
 * quelle que soit la vraie raison, y compris quand des téléchargements
 * existaient. Un refus devenait indiagnosticable.
 *
 * On cherche donc le code PARTOUT dans le message, et on garde ce qui le suit :
 * c'est la cause système (`EPERM`, `EACCES`, `EROFS`…), seule information utile
 * quand le journal du processus principal ne va nulle part — un paquet MSIX ou
 * une app du Mac App Store n'ont pas de console.
 */
export function readRootError(error: unknown): { code: SetRootCode; detail?: string } {
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  for (const code of ROOT_CODES) {
    const at = raw.indexOf(code);
    if (at < 0) continue;
    const detail = raw.slice(at + code.length).replace(/^\s*:\s*/, "").trim();
    return detail === "" ? { code } : { code, detail };
  }
  return { code: "unknown" };
}

export async function getDownloadsRoot(): Promise<string | null> {
  if (!supportsDownloads()) return null;
  try {
    return await invoke<string>("downloads_get_root");
  } catch {
    return null;
  }
}

export async function setDownloadsRoot(path: string): Promise<SetRootResult> {
  if (!supportsDownloads()) return { ok: false, code: "unknown" };
  try {
    const normalized = await invoke<string>("downloads_set_root", { path });
    return { ok: true, path: normalized };
  } catch (error) {
    return { ok: false, ...readRootError(error) };
  }
}

/** Octets libres sur le volume de la racine de téléchargements. */
export async function getDiskFree(): Promise<number | null> {
  if (!supportsDownloads()) return null;
  try {
    return await invoke<number>("downloads_disk_free");
  } catch {
    return null;
  }
}

/** Octets occupés par les téléchargements (partiels compris). */
export async function getDiskUsage(): Promise<number | null> {
  if (!supportsDownloads()) return null;
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
  /** Délai après visionnage avant suppression (minutes, 0 = immédiat). */
  autoDeleteDelayMinutes: number;
  /** Échéance de suppression (epoch secondes) — posée quand l'item est vu. */
  deleteScheduledAt: number | null;
  /** Progression locale de ce compte : coche « vu » et barre des vignettes. */
  played: boolean;
  positionTicks: number;
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
  /** Délai d'auto-suppression après visionnage (minutes, 0 = immédiat). */
  autoDeleteDelayMinutes?: number;
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
  if (!supportsDownloads()) return;
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
  if (!supportsDownloads()) return null;
  try {
    return await invoke<EnqueueOutcome>("downloads_enqueue", { userId, serverUrl, token, items });
  } catch (error) {
    // `console.error` et non `log` : le build de production supprime `log`,
    // `debug` et `info` (`pure` dans `vite.config.ts`). C'est le SEUL appel
    // natif dont l'échec est visible par l'utilisateur — « Impossible de lancer
    // le téléchargement » — et il ne disait pas pourquoi.
    console.error("[downloads] mise en file refusee :", error);
    return null;
  }
}

export async function pauseDownload(fileId: number): Promise<void> {
  if (!supportsDownloads()) return;
  try {
    await invoke("downloads_pause", { fileId });
  } catch { /* no-op */ }
}

export async function resumeDownload(fileId: number): Promise<void> {
  if (!supportsDownloads()) return;
  try {
    await invoke("downloads_resume", { fileId });
  } catch { /* no-op */ }
}

export async function cancelDownload(fileId: number): Promise<void> {
  if (!supportsDownloads()) return;
  try {
    await invoke("downloads_cancel", { fileId });
  } catch { /* no-op */ }
}

export interface DeleteOutcome {
  fileDeleted: boolean;
  metaDeleted: boolean;
}

export async function deleteDownload(userId: string, fileId: number): Promise<DeleteOutcome | null> {
  if (!supportsDownloads()) return null;
  try {
    return await invoke<DeleteOutcome>("downloads_delete", { userId, fileId });
  } catch {
    return null;
  }
}

export async function listDownloads(userId: string): Promise<DownloadEntry[]> {
  if (!supportsDownloads()) return [];
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
  if (!supportsDownloads()) return null;
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
  delayMinutes: number,
): Promise<void> {
  if (!supportsDownloads()) return;
  try {
    await invoke("downloads_set_auto_delete", { userId, fileId, enabled, delayMinutes });
  } catch { /* no-op */ }
}

/** Purge des échéances d'auto-suppression passées ; `itemId` = item qui vient
 *  de se terminer (exempté de la garde « lecture active » — couvre le délai
 *  0 « immédiatement » au démontage du lecteur). */
export async function purgeDueDownloads(itemId?: string): Promise<number> {
  if (!supportsDownloads()) return 0;
  try {
    return await invoke<number>("downloads_purge_due", { itemId: itemId ?? null });
  } catch {
    return 0;
  }
}

export interface DownloadProgressEvent {
  fileId: number;
  bytesDone: number;
  expectedSize: number | null;
}

/** Abonnement aux changements d'état (invalider les listes). */
export async function onDownloadsChanged(callback: () => void): Promise<() => void> {
  if (!supportsDownloads()) return () => undefined;
  return listen("downloads://changed", callback);
}

/** Abonnement à la progression (throttlée côté Rust, ~2 événements/s). */
export async function onDownloadsProgress(
  callback: (event: DownloadProgressEvent) => void,
): Promise<() => void> {
  if (!supportsDownloads()) return () => undefined;
  return listen<DownloadProgressEvent>("downloads://progress", (event) => callback(event.payload));
}
