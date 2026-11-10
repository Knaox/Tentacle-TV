/**
 * Quand tirer l'état de lecture du serveur (bureau) : un titre vient d'arriver
 * sur la machine, ou le catalogue local s'ouvre. Le retour du réseau et le
 * démarrage sont à `ConnectivityBinding`. Rien en mode hors ligne — même à la
 * main alors que le serveur répond, rien ne part ni ne vient.
 */

import { useEffect, useRef } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { useDownloadsListState } from "../downloads/useDownloadState";
import { freshlyKept, syncPlaybackState } from "./playbackSync";
import { useOfflineMode } from "./useOfflineMode";

/** Monté UNE fois (avec `DownloadsEvents`) : chaque titre qui finit d'arriver est rapproché. */
export function usePullOnKeep(): void {
  const userId = useUserId();
  const offline = useOfflineMode();
  const { entries, ready } = useDownloadsListState();
  const knownRef = useRef<{ userId: string; complete: ReadonlySet<string> } | null>(null);

  useEffect(() => {
    if (!ready || !userId) return;
    const complete = new Set<string>();
    for (const entry of entries) if (entry.status === "complete") complete.add(entry.itemId);
    const known = knownRef.current?.userId === userId ? knownRef.current.complete : null;
    knownRef.current = { userId, complete };
    const fresh = freshlyKept(known, complete);
    if (fresh.length === 0 || offline) return;
    void syncPlaybackState(userId, fresh);
  }, [entries, ready, userId, offline]);
}

/** À l'ouverture du catalogue local : le tour complet, au plus une fois par minute. */
export function usePullOnCatalogOpen(): void {
  const userId = useUserId();
  const offline = useOfflineMode();
  useEffect(() => {
    if (!userId || offline) return;
    void syncPlaybackState(userId, "all");
  }, [userId, offline]);
}
