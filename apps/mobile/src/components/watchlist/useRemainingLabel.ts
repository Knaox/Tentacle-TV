import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { watchProgress, watchRemaining, watchStage } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/** « Reste 52 min », « Reste 1 h 10 min », « 3 épisodes restants ». */
export function useRemainingLabel() {
  const { t } = useTranslation("watchlist");
  return useCallback(
    (item: MediaItem): string | null => {
      const left = watchRemaining(item);
      if (!left) return null;
      if (left.kind === "episodes") return t("remainingEpisodes", { count: left.value });
      if (left.value < 60) return t("remainingMinutes", { count: left.value });
      return t("remainingHours", { hours: Math.floor(left.value / 60), minutes: left.value % 60 });
    },
    [t],
  );
}

/** La progression en MOTS, jamais la couleur seule : « 40 % vu · Reste 58 min ». */
export function useProgressText() {
  const { t } = useTranslation("watchlist");
  const remaining = useRemainingLabel();
  return useCallback(
    (item: MediaItem): string => {
      const stage = watchStage(item);
      if (stage === "watched") return t("finished");
      if (stage === "new") return t("notStarted");
      const pct = watchProgress(item);
      return [pct != null ? t("progressPercent", { percent: Math.round(pct) }) : null, remaining(item)]
        .filter(Boolean)
        .join(" · ");
    },
    [remaining, t],
  );
}
