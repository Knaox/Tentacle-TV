import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACCOUNT_ACCESS_ROUTE,
  isBlockedAccountAccess,
  type AccountAccessBlocked,
  type AccountAccessState,
} from "@tentacle-tv/shared";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";
import { resumeSocketSession, subscribeSocket } from "../socket/tentacleSocket";
import { createAccountAccessGate, type AccountAccessFetch } from "./accountAccessGate";
import { readAccountAccess, reportAccountAccess, reportAccountAccessMessage, subscribeAccountAccess } from "./accountAccessSignal";

/**
 * La porte React de l'accès du compte (docs/DROITS-UTILISATEURS.md § 9.1) :
 * l'état bloqué du compte de la session — désactivé, hors plage — ou null.
 * Chaque plateforme la monte UNE fois, à la racine, et rend SA page à la
 * place de l'application quand elle rend un état.
 *
 * Sources : la route d'état (au montage, puis relue par la porte tant que le
 * compte est bloqué), l'annonce `account:access` du socket et son refus
 * d'authentification, et toute réponse 403 `account_access` d'une requête
 * quelconque (`accountAccessSignal`). Derrière la capacité `account.access` :
 * un serveur qui ne la déclare pas ne bloque rien, et rien ne s'affiche.
 *
 * Revenu : toutes les requêtes invalidées, la socket rouverte avec le même
 * jeton, puis `onReopened` de la plateforme. Le compte n'est jamais déconnecté.
 */
export interface AccountAccessOptions {
  /** Une session existe (connectée, jumelée) : sans elle, rien à lire. */
  enabled: boolean;
  onReopened?: () => void;
}

export const fetchAccountAccess: AccountAccessFetch = async () => {
  try {
    const state = await tentacleApiFetch<AccountAccessState>(ACCOUNT_ACCESS_ROUTE);
    if (state?.state === "allowed") return { state: "allowed" };
    return isBlockedAccountAccess(state) ? state : null;
  } catch (error) {
    return error instanceof TentacleApiError && error.status === 401 ? "signedOut" : null;
  }
};

export function useAccountAccess(options: AccountAccessOptions): AccountAccessBlocked | null {
  const { enabled } = options;
  const supported = useServerCapability("account.access");
  const queryClient = useQueryClient();
  const onReopenedRef = useRef(options.onReopened);
  onReopenedRef.current = options.onReopened;

  useEffect(() => {
    // Plus de session (déconnexion) : l'état bloqué n'appartient pas à la suivante.
    if (!enabled) reportAccountAccess({ state: "allowed" });
    if (!enabled || !supported) return;
    const gate = createAccountAccessGate({
      fetchAccess: fetchAccountAccess,
      onReopened: () => {
        void queryClient.invalidateQueries();
        resumeSocketSession();
        onReopenedRef.current?.();
      },
    });
    void gate.checkNow();
    const offSocket = subscribeSocket((message) => {
      reportAccountAccessMessage(message as unknown as Record<string, unknown>);
    });
    return () => {
      offSocket();
      gate.dispose();
    };
  }, [enabled, supported, queryClient]);

  const blocked = useSyncExternalStore(subscribeAccountAccess, readAccountAccess, readAccountAccess);
  return enabled && supported ? blocked : null;
}
