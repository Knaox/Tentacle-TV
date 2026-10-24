/**
 * Le bureau exécute les requêtes que l'extension musique lui confie
 * (capacité `plugins.clientFetch`) : depuis la connexion de l'utilisateur, par
 * le principal (`client_fetch_run`), qui juge chaque requête contre le
 * manifeste qu'il lit lui-même. Le web n'a pas d'exécuteur : rien n'est monté,
 * l'extension passe par le serveur.
 */

import { useMemo } from "react";
import { useClientFetchAgent, type ClientFetchExecutor } from "@tentacle-tv/api-client";
import type { ClientFetchOutcome } from "@tentacle-tv/shared/pluginClientFetch";
import { invoke, supportsClientFetch } from "../../../desktop/bridge";

export function useDesktopClientFetch(enabled: boolean, token: string | null): void {
  const executor = useMemo<ClientFetchExecutor | null>(
    () =>
      enabled && supportsClientFetch()
        ? (job, session) => invoke<ClientFetchOutcome>("client_fetch_run", { serverOrigin: session.serverOrigin, headers: session.headers, pluginId: job.pluginId, request: job.request })
        : null,
    [enabled],
  );
  useClientFetchAgent(executor, token);
}
