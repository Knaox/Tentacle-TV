import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { WatchlistSummary } from "@tentacle-tv/api-client";

/** « 29 titres · 8 en cours · 5 terminés » — les étapes vides se taisent. */
export function useSummaryLine(summary: WatchlistSummary): string {
  const { t } = useTranslation("watchlist");
  return useMemo(
    () =>
      [
        t("statTotal", { count: summary.total }),
        summary.inProgress > 0 ? t("statInProgress", { count: summary.inProgress }) : null,
        summary.watched > 0 ? t("statWatched", { count: summary.watched }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [summary, t],
  );
}
