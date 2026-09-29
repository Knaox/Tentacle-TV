import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JellyfinCompatReport, JellyfinSetupReport, SetupApplyRequest } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { readCompatReport, readSetupReport } from "./jellyfinReaders";

/**
 * Les lectures et les gestes Jellyfin de l'administration — compatibilité
 * (installée, dernière publiée) et réglages recommandés. Partagés par la vue
 * d'ensemble et la page Services : une seule requête, et un geste fait sur
 * l'une se voit sur l'autre.
 */

export const JELLYFIN_ADMIN_KEYS = {
  compat: ["admin", "jellyfin", "compat"],
  setup: ["admin", "jellyfin", "setup"],
} as const;

/** Un refus du serveur, avec son code ; `404` : un serveur Tentacle d'avant ces routes. */
export class JellyfinAdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `HTTP ${String(status)}`);
  }
}

export const isOutdatedServer = (error: unknown) => error instanceof JellyfinAdminError && error.status === 404;

async function call<T>(
  path: string,
  read: (raw: unknown) => T | null,
  { method = "GET", body }: { method?: "GET" | "POST"; body?: object } = {},
): Promise<T> {
  const headers = hdrs();
  // Un POST sans corps mais typé JSON, Fastify le refuse : pas de corps, pas d'en-tête.
  if (body === undefined) delete headers["Content-Type"];
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/admin${path}`, {
      method,
      headers,
      credentials: creds(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new JellyfinAdminError(0, "network");
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = typeof raw === "object" && raw !== null && typeof (raw as { error?: unknown }).error === "string"
      ? (raw as { error: string }).error
      : null;
    throw new JellyfinAdminError(res.status, code);
  }
  const value = read(raw);
  if (value === null) throw new JellyfinAdminError(res.status, "unreadable");
  return value;
}

/** Un serveur trop ancien ne répondra pas mieux la seconde fois. */
const retryUnlessOutdated = (count: number, error: unknown) => !isOutdatedServer(error) && count < 1;

export function useJellyfinCompat() {
  return useQuery({
    queryKey: JELLYFIN_ADMIN_KEYS.compat,
    queryFn: () => call("/jellyfin/compat", readCompatReport),
    // Le serveur relit lui-même ce qui a vieilli (six heures) : une minute suffit ici.
    staleTime: 60_000,
    retry: retryUnlessOutdated,
  });
}

/** « Revérifier » : le manifeste publié et GitHub relus sans attendre qu'ils vieillissent. */
export function useCompatRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call("/jellyfin/compat/refresh", readCompatReport, { method: "POST" }),
    onSuccess: (report) => queryClient.setQueryData<JellyfinCompatReport>(JELLYFIN_ADMIN_KEYS.compat, report),
  });
}

/**
 * Le rapport des réglages, lu une fois. Le guide « Bandes-annonces » n'en veut
 * que `dashboardUrl` (ses liens vers le tableau de bord) : il partage la clé,
 * sans le suivi serré de la vue d'ensemble.
 */
export const fetchJellyfinSetup = () => call("/jellyfin/setup", readSetupReport);

export function useJellyfinSetup() {
  return useQuery({
    queryKey: JELLYFIN_ADMIN_KEYS.setup,
    queryFn: fetchJellyfinSetup,
    // C'est l'état d'aujourd'hui qu'on vient y chercher.
    staleTime: 0,
    retry: retryUnlessOutdated,
    // Une tâche lancée d'ici (génération, repérage) ou une actualisation de
    // bibliothèque se suit jusqu'au bout.
    refetchInterval: (query) =>
      query.state.data?.checks.some((check) => check.task?.state === "running" || check.trailers?.refreshing) ? 5000 : false,
  });
}

interface ApplyResult {
  changed: number;
  report: JellyfinSetupReport;
}

function readApplyResult(raw: unknown): ApplyResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { changed, report } = raw as { changed?: unknown; report?: unknown };
  const read = readSetupReport(report);
  return read ? { changed: typeof changed === "number" ? changed : 0, report: read } : null;
}

/** Un geste en un clic ; la réponse porte l'état relu, posé tel quel dans le cache. */
export function useSetupApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetupApplyRequest) => call("/jellyfin/setup/apply", readApplyResult, { method: "POST", body: request }),
    onSuccess: ({ report }) => queryClient.setQueryData<JellyfinSetupReport>(JELLYFIN_ADMIN_KEYS.setup, report),
  });
}
