import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveServerCapabilities, type DatabaseMigrationView } from "@tentacle-tv/shared";
import { appConfigQuery } from "../hooks/useConfig";
import { onSocketStatus, reconnectSocketNow } from "../socket/tentacleSocket";
import { createMigrationGate, type MigrationGate } from "./migrationGate";
import { fetchHealthSample } from "./migrationPoller";

/**
 * La porte React de l'écran d'attente de la migration de la base : la décision
 * (`migrationGate`, la même partout) branchée sur le cache TanStack. Chaque
 * plateforme la monte UNE fois, à la racine de sa session, et rend son écran
 * quand elle rend une vue.
 *
 * Au retour (base prête) : toutes les requêtes invalidées, la socket
 * reconnectée tout de suite, puis `onResume` de la plateforme. Le compte et
 * son jeton ne sont jamais touchés.
 */
export interface DatabaseMigrationGateOptions {
  /** L'adresse du serveur Tentacle (`""` : même origine, web) ; `null` : aucune.
   *  Une fonction est relue à chaque lecture de `/api/health` (TV : le serveur
   *  choisi au jumelage, sans nouveau rendu). */
  backendUrl: string | null | (() => string | null);
  /** Ce que la plateforme fait de plus au retour (relancer sa sonde…). */
  onResume?: () => void;
}

export function useDatabaseMigrationGate(options: DatabaseMigrationGateOptions): DatabaseMigrationView | null {
  const { backendUrl } = options;
  const queryClient = useQueryClient();
  const onResumeRef = useRef(options.onResume);
  onResumeRef.current = options.onResume;
  const [gate, setGate] = useState<MigrationGate | null>(null);

  useEffect(() => {
    if (backendUrl === null) return;
    const next = createMigrationGate({
      // Relue SANS le cache : celle du cache peut venir du serveur d'avant la mise à jour.
      refetchConfig: () => queryClient.fetchQuery({ ...appConfigQuery(), staleTime: 0 }),
      hasCapability: () =>
        resolveServerCapabilities(queryClient.getQueryData(appConfigQuery().queryKey)).has("server.databaseMigration"),
      fetchHealth: typeof backendUrl === "function" ? lazyHealth(backendUrl) : fetchHealthSample(backendUrl),
      watchServerDrop: (onDrop) => onSocketStatus((status) => {
        if (status === "closed") onDrop();
      }),
      onResume: () => {
        void queryClient.invalidateQueries();
        reconnectSocketNow();
        onResumeRef.current?.();
      },
    });
    setGate(next);
    return () => {
      next.dispose();
      setGate(null);
    };
  }, [backendUrl, queryClient]);

  return useSyncExternalStore(gate?.subscribe ?? noSubscribe, gate?.read ?? nothing, gate?.read ?? nothing);
}

/** `/api/health` du serveur courant ; aucun serveur : aucune réponse. */
function lazyHealth(url: () => string | null) {
  return () => {
    const base = url();
    return base === null ? Promise.resolve(null) : fetchHealthSample(base)();
  };
}

const noSubscribe = () => () => undefined;
const nothing = () => null;
