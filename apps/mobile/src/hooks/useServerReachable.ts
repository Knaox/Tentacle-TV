import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * Détecte si le serveur Tentacle/Jellyfin est joignable.
 * - Ping /api/health avec timeout 5s
 * - Ping périodique (15s) quand offline
 * - Re-check au retour au premier plan (AppState)
 * - Détecte les erreurs réseau globales de React Query
 */
export function useServerReachable() {
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const [isReachable, setIsReachable] = useState(true);
  /** Un essai MANUEL est en cours — le bouton « Réessayer » le montre. */
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkServer = useCallback(async () => {
    if (!serverUrl) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${serverUrl}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsReachable(res.ok);
    } catch {
      setIsReachable(false);
    }
  }, [serverUrl]);

  // L'essai manuel ATTEND le ping et se montre au moins 600 ms : un échec
  // instantané (réseau coupé) ferait sinon clignoter le bouton sans qu'on
  // voie qu'un test a eu lieu.
  const retry = useCallback(async () => {
    setIsChecking(true);
    try {
      await Promise.all([
        checkServer(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setIsChecking(false);
    }
  }, [checkServer]);

  // Ping périodique quand offline
  useEffect(() => {
    if (!isReachable && serverUrl) {
      intervalRef.current = setInterval(checkServer, 15_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReachable, serverUrl, checkServer]);

  // Re-check au retour au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkServer();
    });
    return () => sub.remove();
  }, [checkServer]);

  // Écoute les erreurs réseau globales de React Query
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action?.type === "error"
      ) {
        const error = event.action.error;
        const isNetworkError = error instanceof TypeError && error.message === "Network request failed";
        const isServerError = (error as any)?.status >= 500;
        if (isNetworkError || isServerError) {
          checkServer();
        }
      }
    });
    return unsubscribe;
  }, [queryClient, checkServer]);

  return { isReachable, isChecking, retry };
}
