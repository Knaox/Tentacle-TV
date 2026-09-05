import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PreferencesScope, WsServerMessage } from "@tentacle-tv/shared";
import { acquireSocket, onSocketStatus, subscribeSocket } from "../socket/tentacleSocket";
import type { SocketStatus } from "../socket/tentacleSocket";
import { invalidateRecoQueries } from "./useRecoPage";

/** Les blocs diffusés en direct → la clé de cache de chacun (préfixe des sauvegardes). */
export const PREFERENCES_LIVE_SCOPES: readonly PreferencesScope[] = ["home-layout", "reco-settings"];

/**
 * Applique un `preferences:update` reçu d'un autre appareil : relire le bloc —
 * SAUF si une sauvegarde locale de ce même bloc est en vol ou en attente
 * (`isMutating` sur le préfixe attrape les sauvegardes de bloc entier comme
 * les patches lire-avant-d'écrire) : un refetch écraserait l'optimiste par
 * une lecture périmée, et la dernière mutation relit de toute façon la
 * vérité en se terminant. Renvoie vrai si le bloc a été invalidé.
 * API commune v4 / v5 seulement (la TV tourne en v4).
 */
export function applyPreferencesUpdate(qc: QueryClient, scope: PreferencesScope): boolean {
  if (qc.isMutating({ mutationKey: [scope] }) > 0) return false;
  void qc.invalidateQueries({ queryKey: [scope] });
  // Les réglages changent les rangées elles-mêmes : la page suit.
  if (scope === "reco-settings") invalidateRecoQueries(qc);
  return true;
}

/** Rattrapage après une coupure : tout ce qui a pu changer pendant l'absence. */
export function catchUpPreferences(qc: QueryClient): void {
  for (const scope of PREFERENCES_LIVE_SCOPES) applyPreferencesUpdate(qc, scope);
}

export interface UsePreferencesLiveOptions {
  /** Auth par message (desktop/mobile/TV) ; undefined = cookie (web). */
  token?: string | null;
  enabled?: boolean;
}

/**
 * Un réglage enregistré sur un autre appareil arrive en direct : la mise en
 * page de l'accueil et les réglages de recommandation se relisent en
 * SILENCE (l'accueil se réordonne sans rien toucher). Au retour « open »
 * après une coupure, un rattrapage. Consomme le socket PARTAGÉ (tentacleSocket)
 * comme useRecoLive ; un seul montage suffit par application.
 */
export function usePreferencesLive(options: UsePreferencesLiveOptions = {}): void {
  const { token, enabled = true } = options;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const release = acquireSocket(token ?? undefined);
    const offMessage = subscribeSocket((msg: WsServerMessage) => {
      if (msg.type === "preferences:update") applyPreferencesUpdate(qc, msg.scope);
    });
    let hadOpen = false;
    let previous: SocketStatus | null = null;
    const offStatus = onSocketStatus((status) => {
      if (status === "open" && hadOpen && previous !== "open") catchUpPreferences(qc);
      if (status === "open") hadOpen = true;
      previous = status;
    });
    return () => {
      offMessage();
      offStatus();
      release();
    };
  }, [enabled, token, qc]);
}
