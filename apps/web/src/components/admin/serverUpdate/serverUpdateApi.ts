import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServerUpdateReport } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { readServerUpdateReport } from "./serverUpdateReader";

/**
 * La lecture de la carte « Serveur Tentacle » (`/api/admin/server-update`).
 * Le serveur garde la dernière publication six heures : relire ici ne coûte
 * aucun appel à GitHub. Relue au retour sur l'onglet — on revient souvent du
 * terminal où l'on vient de lancer la mise à jour — et toutes les cinq
 * secondes pendant qu'on attend le redémarrage (`watching`).
 *
 * La réponse passe par `readServerUpdateReport`, qui tient chaque champ pour suspect.
 */

export const SERVER_UPDATE_KEY = ["admin", "server-update"] as const;

/** `404` : un serveur d'avant cette route ; `0` : injoignable (pendant un redémarrage). */
export class ServerUpdateError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${String(status)}`);
  }
}

export const isOutdatedUpdateServer = (error: unknown) => error instanceof ServerUpdateError && error.status === 404;

async function call(path: string, method: "GET" | "POST"): Promise<ServerUpdateReport> {
  const headers = hdrs();
  // Un POST sans corps mais typé JSON, Fastify le refuse.
  if (method === "POST") delete headers["Content-Type"];
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/admin${path}`, { method, headers, credentials: creds() });
  } catch {
    throw new ServerUpdateError(0);
  }
  if (!res.ok) throw new ServerUpdateError(res.status);
  const report = readServerUpdateReport(await res.json().catch(() => null));
  if (!report) throw new ServerUpdateError(res.status);
  return report;
}

export function useServerUpdate({ watching = false }: { watching?: boolean } = {}) {
  return useQuery({
    queryKey: SERVER_UPDATE_KEY,
    queryFn: () => call("/server-update", "GET"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: watching ? 5000 : false,
    // Un serveur trop ancien ne répondra pas mieux la seconde fois.
    retry: (count, error) => !isOutdatedUpdateServer(error) && count < 1,
  });
}

/** « Revérifier » : GitHub relu sans attendre (le serveur s'en garde à une fois par minute). */
export function useServerUpdateRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call("/server-update/refresh", "POST"),
    onSuccess: (report) => queryClient.setQueryData<ServerUpdateReport>(SERVER_UPDATE_KEY, report),
  });
}
