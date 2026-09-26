import { useQuery } from "@tanstack/react-query";
import { useAllTickets } from "@tentacle-tv/api-client";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { useAdminSessions } from "../../../hooks/useAdminSessions";
import {
  readServicesHealth,
  summarizeAccounts,
  summarizeDownloads,
  summarizeInvites,
  summarizePlugins,
  summarizeSessions,
  ticketTotal,
} from "./overviewSummary";

/**
 * Les lectures de la vue d'ensemble — une requête par tuile, en parallèle :
 * chaque tuile s'affiche dès que SA réponse arrive (la sonde des services peut
 * prendre trois secondes, le catalogue des plugins interroge des registres
 * distants) au lieu d'attendre la plus lente.
 *
 * Des clés À ELLES (`["admin", "overview", …]`) plutôt que celles des pages :
 * une même entrée de cache lue par deux lecteurs différents casse dès que l'un
 * des deux y range autre chose que la réponse brute. `staleTime: 0` : revenir
 * sur l'accueil relit l'état, c'est ce qu'on vient y chercher.
 *
 * Les sessions et les tickets réutilisent les requêtes de leurs pages (même
 * forme, même lecteur) : la relève des sessions toutes les trois secondes, tant
 * que la page est visible, garde le compteur « en direct ».
 */

export const ADMIN_OVERVIEW_KEY = ["admin", "overview"] as const;

async function readJson(path: string): Promise<unknown> {
  const res = await fetch(`${BACKEND}${path}`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function useOverviewRead<T>(part: string, path: string, select: (raw: unknown) => T) {
  return useQuery({
    queryKey: [...ADMIN_OVERVIEW_KEY, part],
    queryFn: () => readJson(path),
    select,
    staleTime: 0,
    retry: 1,
  });
}

/** Ce qu'une tuile reçoit : la donnée résumée, ou pourquoi elle n'est pas là. */
export interface OverviewPart<T> {
  data: T | null;
  loading: boolean;
}

function part<T>(query: { data?: T | null; isPending: boolean; isError: boolean }): OverviewPart<T> {
  return { data: query.isError ? null : (query.data ?? null), loading: query.isPending && !query.isError };
}

export function useServicesHealth() {
  return part(useOverviewRead("services", "/api/admin/services", readServicesHealth));
}

export function useAccountsSummary() {
  return part(useOverviewRead("users", "/api/admin/users", summarizeAccounts));
}

export function useInvitesSummary() {
  return part(useOverviewRead("invites", "/api/invites", (raw) => summarizeInvites(raw, Date.now())));
}

export function useDownloadsSummary() {
  return part(useOverviewRead("downloads", "/api/admin/downloads/users", summarizeDownloads));
}

export function usePluginsSummary() {
  const installed = useOverviewRead("plugins", "/api/plugins", (raw) => raw);
  const catalog = useOverviewRead("marketplace", "/api/plugins/marketplace", (raw) => raw);
  return {
    data: installed.isError ? null : summarizePlugins(installed.data, catalog.isError ? undefined : catalog.data),
    // Le chiffre de la tuile vient du catalogue : on l'attend, sauf s'il échoue.
    loading: (installed.isPending && !installed.isError) || (catalog.isPending && !catalog.isError),
    catalogFailed: catalog.isError,
  };
}

export function useSessionsSummary(): OverviewPart<ReturnType<typeof summarizeSessions>> {
  const query = useAdminSessions();
  return { data: query.isError ? null : summarizeSessions(query.data), loading: query.isPending && !query.isError };
}

export function useTicketsSummary() {
  // `limit: 1` : seul le total de chaque statut compte, pas la liste.
  const open = useAllTickets("open", 1, 1);
  const inProgress = useAllTickets("in_progress", 1, 1);
  return {
    data: open.isError ? null : { open: ticketTotal(open.data), inProgress: ticketTotal(inProgress.data) ?? 0 },
    loading: open.isPending && !open.isError,
  };
}
