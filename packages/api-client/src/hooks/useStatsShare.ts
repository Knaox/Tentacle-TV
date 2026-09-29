import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deviceTimeZone } from "@tentacle-tv/shared";
import type { StatsShareLink, ViewingStatsPeriod } from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "./usePreferences";

/**
 * Partager ses statistiques — le lien du PROPRIÉTAIRE (`/api/share/stats`).
 * Le même mécanisme que Ma liste et Favoris (un lien par compte, révocable),
 * plus la période qu'il choisit de montrer. Le fuseau de l'appareil part
 * avec la période : la page publique compte les jours à SON heure, et le
 * serveur le garde pour lui.
 */

export const STATS_SHARE_KEY = ["share", "mine", "stats"] as const;

const NO_LINK: StatsShareLink = { token: null, period: null };

/**
 * Pourquoi le partage des statistiques échoue : un serveur trop ancien (404 —
 * la route n'existe pas) ou une base sans sa colonne (503 qui la nomme) ne se
 * disent pas comme un échec passager.
 */
export type StatsShareFailure = "outdated" | "error";

export function statsShareFailure(error: unknown): StatsShareFailure {
  if (!(error instanceof TentacleApiError)) return "error";
  if (error.status === 404) return "outdated";
  return error.status === 503 && error.message.includes("share_links") ? "outdated" : "error";
}

export const fetchMyStatsShare = (): Promise<StatsShareLink> => tentacleApiFetch<StatsShareLink>("/api/share/stats/mine");

export const saveStatsShare = (period: ViewingStatsPeriod): Promise<StatsShareLink> =>
  tentacleApiFetch<StatsShareLink>("/api/share/stats", { method: "POST", body: JSON.stringify({ period, tz: deviceTimeZone() }) });

export const revokeStatsShare = (): Promise<{ ok: boolean }> =>
  tentacleApiFetch<{ ok: boolean }>("/api/share/stats", { method: "DELETE" });

/** Mon lien et la période qu'il montre ; `{ token: null, period: null }` sans lien. */
export function useMyStatsShare(enabled = true) {
  return useQuery({
    queryKey: STATS_SHARE_KEY,
    queryFn: fetchMyStatsShare,
    enabled,
    staleTime: 30_000,
    // Un serveur trop ancien ne répondra pas mieux à la seconde tentative.
    retry: (count, error) => statsShareFailure(error) === "error" && count < 1,
  });
}

/** Crée le lien, ou change sa période — le jeton ne change pas. */
export function useSaveStatsShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveStatsShare,
    onSuccess: (link) => qc.setQueryData(STATS_SHARE_KEY, link),
  });
}

/** Révoque le lien : la page publique ne s'ouvre plus, pour personne. */
export function useRevokeStatsShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeStatsShare,
    onSuccess: () => qc.setQueryData(STATS_SHARE_KEY, NO_LINK),
  });
}
