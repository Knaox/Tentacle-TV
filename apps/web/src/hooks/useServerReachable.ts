import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { backendUrl } from "../main";

/**
 * Détecte si le backend Tentacle ET le serveur Jellyfin sont joignables.
 * - Ping /api/health (backend) + /api/jellyfin/System/Info/Public (Jellyfin)
 * - Ping périodique (15s) quand offline
 * - Re-check au retour sur l'onglet (visibilitychange)
 * - Détecte les erreurs réseau ET les 502 de React Query
 */
export function useServerReachable() {
  const queryClient = useQueryClient();
  const [isReachable, setIsReachable] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCheckedRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const lastReconnectRef = useRef(0);

  const checkServer = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Check backend health
      const backendRes = await fetch(`${backendUrl}/api/health`, {
        signal: controller.signal,
      });
      if (!backendRes.ok) {
        clearTimeout(timeout);
        hasCheckedRef.current = true;
        setIsReachable(false);
        return;
      }

      // Check Jellyfin via proxy (502/503 = Jellyfin down)
      const jellyfinRes = await fetch(`${backendUrl}/api/jellyfin/System/Info/Public`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      hasCheckedRef.current = true;
      // 503 = Jellyfin not configured (setup wizard) → don't mark offline
      if (jellyfinRes.status === 503) {
        setIsReachable(true);
      } else {
        setIsReachable(jellyfinRes.ok);
      }
    } catch {
      hasCheckedRef.current = true;
      setIsReachable(false);
    }
  }, []);

  const retry = useCallback(() => {
    checkServer();
  }, [checkServer]);

  // Invalide les queries quand le serveur revient (échelonné pour éviter un burst)
  useEffect(() => {
    if (!isReachable) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      // Debounce: ignore rapid offline→online transitions within 5s
      if (Date.now() - lastReconnectRef.current < 5000) return;
      lastReconnectRef.current = Date.now();
      // Critical queries first
      queryClient.invalidateQueries({ queryKey: ["resume-items"] });
      queryClient.invalidateQueries({ queryKey: ["next-up"] });
      queryClient.invalidateQueries({ queryKey: ["featured"] });
      // Stagger remaining queries to avoid request burst
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["latest-items"] });
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["libraries"] });
      }, 2000);
    }
  }, [isReachable, queryClient]);

  // Ping périodique quand offline
  useEffect(() => {
    if (!isReachable && hasCheckedRef.current) {
      intervalRef.current = setInterval(checkServer, 15_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReachable, checkServer]);

  // Re-check au retour sur l'onglet
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkServer();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [checkServer]);

  // Écoute les erreurs réseau ET les 502/503 de React Query (queries + mutations)
  useEffect(() => {
    const handleError = (error: unknown) => {
      const msg = (error as Error)?.message ?? "";
      const isNetworkError = error instanceof TypeError && msg === "Failed to fetch";
      const isServerError = (error as any)?.status >= 500 || msg.includes("500") || msg.includes("502") || msg.includes("503");
      if (isNetworkError || isServerError) {
        checkServer();
      }
    };

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action?.type === "error") {
        handleError(event.action.error);
      }
    });
    const unsubMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action?.type === "error") {
        handleError(event.action.error);
      }
    });
    return () => { unsubQuery(); unsubMutation(); };
  }, [queryClient, checkServer]);

  return { isReachable: isReachable || !hasCheckedRef.current, retry };
}
