import { useEffect, useRef } from "react";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { startClientFetchAgent, type ClientFetchExecutor } from "./clientFetchAgent";

/**
 * L'agent des requêtes déléguées, monté tant que la plateforme sait les
 * exécuter (`executor`, le bureau) ET que le serveur le déclare
 * (`plugins.clientFetch`). Sinon rien : aucune annonce, tout passe par le serveur.
 */
export function useClientFetchAgent(executor: ClientFetchExecutor | null, token?: string | null): void {
  const capable = useServerCapability("plugins.clientFetch");
  const current = useRef(executor);
  current.current = executor;
  const enabled = capable && executor !== null;

  useEffect(() => {
    if (!enabled) return;
    return startClientFetchAgent((job, session) => {
      const run = current.current;
      return run ? run(job, session) : Promise.resolve({ ok: false, reason: "refused" });
    }, token);
  }, [enabled, token]);
}
