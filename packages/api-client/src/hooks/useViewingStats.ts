import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deviceTimeZone } from "@tentacle-tv/shared";
import type { StatsLocale, ViewingStats, ViewingStatsPeriod } from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "./usePreferences";

/**
 * Les statistiques de visionnage du compte (`GET /api/stats/me`).
 *
 * Le fuseau de l'appareil part avec chaque demande : les jours et les heures
 * sont ceux de l'utilisateur, pas ceux du serveur. Il est lu une fois par
 * session d'application — un voyage à l'étranger en cours de route ne vaut
 * pas un rechargement.
 */

export const VIEWING_STATS_KEY = ["viewing-stats"] as const;

let sessionTimeZone: string | null = null;
function timeZone(): string {
  if (sessionTimeZone === null) sessionTimeZone = deviceTimeZone();
  return sessionTimeZone;
}

export function viewingStatsKey(period: ViewingStatsPeriod, locale: StatsLocale) {
  return [...VIEWING_STATS_KEY, period, locale, timeZone()] as const;
}

export function fetchViewingStats(
  period: ViewingStatsPeriod,
  locale: StatsLocale,
  opts: { refresh?: boolean } = {}
): Promise<ViewingStats> {
  const q = new URLSearchParams({ period, lang: locale, tz: timeZone() });
  if (opts.refresh) q.set("refresh", "1");
  return tentacleApiFetch<ViewingStats>(`/api/stats/me?${q.toString()}`);
}

/**
 * Pourquoi les statistiques manquent : un serveur trop ancien pour connaître
 * la route (404) ne se dit pas comme un Jellyfin injoignable (502/503).
 */
export type ViewingStatsFailure = "outdated" | "unavailable";

export function viewingStatsFailure(error: unknown): ViewingStatsFailure {
  return error instanceof TentacleApiError && error.status === 404 ? "outdated" : "unavailable";
}

/**
 * Une période des statistiques. Changer de période garde l'écran précédent à
 * l'affichage le temps de la réponse (`placeholderData`) : aucun squelette ne
 * clignote, et le serveur, qui calcule les trois périodes d'un coup, répond
 * alors depuis son cache.
 */
export function useViewingStats(period: ViewingStatsPeriod, locale: StatsLocale, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: viewingStatsKey(period, locale),
    queryFn: () => fetchViewingStats(period, locale),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    // Un serveur trop ancien ne répondra pas mieux à la seconde tentative.
    retry: (count, error) => viewingStatsFailure(error) !== "outdated" && count < 1,
  });
}

/**
 * « Tirer pour rafraîchir » : le serveur recalcule (au plus une fois toutes
 * les 30 s), la période affichée est remplacée, les deux autres sont
 * marquées périmées — elles repartiront du calcul frais à la prochaine vue.
 */
export function useRefreshViewingStats() {
  const qc = useQueryClient();
  return useCallback(
    async (period: ViewingStatsPeriod, locale: StatsLocale) => {
      const fresh = await fetchViewingStats(period, locale, { refresh: true });
      await qc.invalidateQueries({ queryKey: VIEWING_STATS_KEY, refetchType: "none" });
      qc.setQueryData(viewingStatsKey(period, locale), fresh);
      return fresh;
    },
    [qc]
  );
}
