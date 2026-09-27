import { memo } from "react";
import { useTranslation } from "react-i18next";
import { watchProgress, watchRemaining, watchStage } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/** « Reste 52 min », « Reste 1 h 10 min », « 3 épisodes restants ». */
export function useRemainingLabel() {
  const { t } = useTranslation("watchlist");
  return (item: MediaItem): string | null => {
    const left = watchRemaining(item);
    if (!left) return null;
    if (left.kind === "episodes") return t("remainingEpisodes", { count: left.value });
    if (left.value < 60) return t("remainingMinutes", { count: left.value });
    return t("remainingHours", { hours: Math.floor(left.value / 60), minutes: left.value % 60 });
  };
}

/**
 * La progression d'un titre, en barre ET en mots — jamais la couleur seule.
 *
 * Remplissage `--progress-fill`, la teinte unique des progressions de l'app
 * (cf. `CardProgressBar`). Largeur posée une fois, sans transition : une
 * largeur animée repeindrait la ligne à chaque image.
 */
export const WatchProgressLine = memo(function WatchProgressLine({
  item,
  compact = false,
}: {
  item: MediaItem;
  compact?: boolean;
}) {
  const { t } = useTranslation("watchlist");
  const remainingLabel = useRemainingLabel();
  const stage = watchStage(item);
  const percent = watchProgress(item);

  if (stage === "new") {
    return <p className="text-xs text-content-quaternary">{t("notStarted")}</p>;
  }

  const rounded = percent != null ? Math.round(percent) : null;
  const label =
    stage === "watched"
      ? t("finished")
      : [rounded != null ? t("progressPercent", { percent: rounded }) : null, remainingLabel(item)]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "max-w-md"}`}>
      {percent != null && (
        <div
          className="h-1 min-w-[64px] flex-1 overflow-hidden rounded-full bg-fill-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded ?? 0}
          aria-label={label}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${percent}%`, background: "var(--progress-fill)" }}
          />
        </div>
      )}
      <span
        className={`shrink-0 text-xs font-medium tabular-nums ${
          stage === "watched" ? "text-status-success-fg" : "text-content-tertiary"
        }`}
      >
        {label}
      </span>
    </div>
  );
});
