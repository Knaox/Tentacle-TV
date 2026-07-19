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
