import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Détecte si le serveur Tentacle est joignable, sans alarmer trop vite.
 *
 * Comportement :
 * - Au premier signal d'erreur (réseau ou 5xx d'une query), on lance un check
 *   de confirmation. On ne marque le serveur "offline" qu'après PERSISTENT_KO_MS
 *   d'échecs consécutifs (12 s) — ça absorbe un redémarrage backend de 5-15 s
 *   sans afficher de bannière à l'utilisateur.
 * - Une fois marqué offline, ping toutes les 5 s pour détecter le retour rapide.
 * - Au retour : on invalide les queries actives pour rafraîchir, mais on ne
 *   touche JAMAIS à l'état d'auth (le token reste valide, pas de logout).
 * - Re-check au passage foreground.
 *
 * Cette stratégie protège la TV des redémarrages backend transitoires : si le
 * backend revient en moins de 12 s, l'utilisateur ne voit aucune bannière.
 */
const PROBE_TIMEOUT_MS = 4000;
const PERSISTENT_KO_MS = 12_000;
const POLL_OFFLINE_MS = 5_000;

export function useServerReachable(serverUrl: string | null) {
  const queryClient = useQueryClient();
  const [isReachable, setIsReachable] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timestamp du premier échec consécutif. Reset dès qu'un check réussit.
  const firstKoAtRef = useRef<number | null>(null);
  const wasOfflineRef = useRef(false);

  const probeServer = useCallback(async (): Promise<boolean> => {
    if (!serverUrl) return true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`${serverUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }, [serverUrl]);

  const evaluate = useCallback(async () => {
    const ok = await probeServer();
    if (ok) {
      firstKoAtRef.current = null;
      if (!isReachable || wasOfflineRef.current) {
        // Le serveur vient de revenir : rafraîchit les données stale, sans
        // toucher à l'auth (cache reste, pas de logout).
        queryClient.invalidateQueries();
      }
      wasOfflineRef.current = false;
      setIsReachable(true);
      return;
    }
    // Échec : on note la 1ère erreur, on n'alarme qu'au-delà du seuil.
    if (firstKoAtRef.current == null) firstKoAtRef.current = Date.now();
    const elapsed = Date.now() - firstKoAtRef.current;
    if (elapsed >= PERSISTENT_KO_MS) {
      wasOfflineRef.current = true;
      setIsReachable(false);
    }
  }, [probeServer, queryClient, isReachable]);

  const retry = useCallback(() => { void evaluate(); }, [evaluate]);

  // Ping rapide quand on est marqué offline pour détecter le retour vite
  useEffect(() => {
    if (!isReachable && serverUrl) {
      intervalRef.current = setInterval(() => { void evaluate(); }, POLL_OFFLINE_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReachable, serverUrl, evaluate]);

  // Re-check au retour foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void evaluate();
    });
    return () => sub.remove();
  }, [evaluate]);

  // Écoute les erreurs réseau + HTTP 500+ de React Query : déclenche evaluate()
  // mais ne marque pas immédiatement offline (cf. seuil PERSISTENT_KO_MS).
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (event.type === "updated" && event.action?.type === "error") {
        const error = event.action.error;
        const isNetworkError = error instanceof TypeError && error.message === "Network request failed";
        const isServerError = (error as { status?: number })?.status !== undefined && (error as { status: number }).status >= 500;
        if (isNetworkError || isServerError) {
          void evaluate();
        }
      }
    });
    return unsubscribe;
  }, [queryClient, evaluate]);

  return { isReachable, retry };
}
