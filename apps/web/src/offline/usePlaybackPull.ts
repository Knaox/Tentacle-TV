/**
 * Quand tirer l'état de lecture du serveur (bureau) : un titre vient d'arriver
 * sur la machine, le catalogue local s'ouvre, ou « vu » vient d'être basculé à
 * la main en ligne. Le retour du réseau et le démarrage sont à
 * `ConnectivityBinding`. Rien en mode hors ligne — même à la
 * main alors que le serveur répond, rien ne part ni ne vient.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { useDownloadsListState } from "../downloads/useDownloadState";
import { freshlyKept, isWatchedGestureSuccess, syncPlaybackState } from "./playbackSync";
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

/**
 * « Vu » basculé à la main, en ligne (carte, fiche, série entière) : la base
 * locale des titres gardés l'apprend dans la foulée — sinon « Sur cet
 * appareil » et la reprise locale disaient encore l'état d'avant.
 */
export function usePullOnWatchedGesture(): void {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const offline = useOfflineMode();
  useEffect(() => {
    if (!userId || offline) return;
    return queryClient.getMutationCache().subscribe((event) => {
      // Une série marque tous ses épisodes : le tour complet, sans attendre la minute.
      if (isWatchedGestureSuccess(event)) void syncPlaybackState(userId, "all", { force: true });
    });
  }, [queryClient, userId, offline]);
}
