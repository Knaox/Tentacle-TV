/**
 * Pont entre TanStack Query et le store de connectivité. Monté UNE fois dans
 * l'arbre App (web ET desktop) :
 * - toute erreur réseau/5xx d'une query ou mutation déclenche une sonde ;
 * - au retour en ligne, invalide les queries critiques en cascade échelonnée
 *   (logique reprise de l'ancien useServerReachable, désormais commune).
 * Ne rend rien.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectivity } from "./useConnectivity";
import { reportPossibleOutage } from "./connectivityStore";

const RECONNECT_DEBOUNCE_MS = 5_000;
const STAGGER_DELAY_MS = 2_000;

const looksLikeOutage = (error: unknown): boolean => {
  const msg = (error as Error)?.message ?? "";
  const isNetworkError = error instanceof TypeError && msg === "Failed to fetch";
  const status = (error as { status?: number })?.status;
  const isServerError =
    (typeof status === "number" && status >= 500) ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503");
  return isNetworkError || isServerError;
};

export function ConnectivityBinding() {
  const queryClient = useQueryClient();
  const { state } = useConnectivity();
  const prevStateRef = useRef(state);
  const lastReconnectRef = useRef(0);

  // Erreurs applicatives → sonde immédiate (throttlée par le store).
  useEffect(() => {
    const handleError = (error: unknown) => {
      if (looksLikeOutage(error)) reportPossibleOutage();
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
    return () => {
      unsubQuery();
      unsubMutation();
    };
  }, [queryClient]);

  // Transition hors ligne → en ligne : rafraîchissement échelonné du catalogue.
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    const wasOffline = prev === "offline-auto" || prev === "offline-manual";
    if (!wasOffline || state !== "online") return;
    if (Date.now() - lastReconnectRef.current < RECONNECT_DEBOUNCE_MS) return;
    lastReconnectRef.current = Date.now();
    queryClient.invalidateQueries({ queryKey: ["resume-items"] });
    queryClient.invalidateQueries({ queryKey: ["next-up"] });
    queryClient.invalidateQueries({ queryKey: ["featured"] });
    const staggered = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["latest-items"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
    }, STAGGER_DELAY_MS);
    return () => clearTimeout(staggered);
  }, [state, queryClient]);

  return null;
}
