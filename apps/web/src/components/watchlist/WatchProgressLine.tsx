import { memo } from "react";
import { useTranslation } from "react-i18next";
import { watchProgress, watchRemaining, watchStage, type WatchStage } from "@tentacle-tv/api-client";
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
 * L'étape à MONTRER : celle du cache, corrigée par le geste en cours quand l'appelant le
 * connaît (`useCardMarkers`). « Vu » posé à l'instant donne « Terminé » sans attendre le
 * serveur ; « non vu » posé sur un titre terminé le rend à « Pas encore commencé ».
 */
export function shownWatchStage(item: MediaItem, watched: boolean | undefined): WatchStage {
  const cached = watchStage(item);
  if (watched === true) return "watched";
  if (watched === false && cached === "watched") return "new";
  return cached;
}

/**
 * La progression d'un titre, en jauge ET en mots — jamais la couleur seule.
 *
 * La jauge du socle (`.gauge`) : ce qui se MESURE porte le dégradé du logo, et son remplissage
 * est un enfant mis à l'échelle (`scaleX`), jamais une largeur. Posée une fois, sans
 * transition : la ligne n'est pas une lecture en cours.
 */
export const WatchProgressLine = memo(function WatchProgressLine({
  item,
  compact = false,
  watched,
}: {
  item: MediaItem;
  compact?: boolean;
  /** « Vu » tel que les marqueurs le disent (geste en cours compris) ; absent : le cache seul. */
  watched?: boolean;
}) {
  const { t } = useTranslation("watchlist");
  const remainingLabel = useRemainingLabel();
  const stage = shownWatchStage(item, watched);

  if (stage === "new") {
    return <p className="text-xs text-content-tertiary">{t("notStarted")}</p>;
  }

  const percent = stage === "watched" ? 100 : watchProgress(item);
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
          className="gauge min-w-[64px] flex-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded ?? 0}
          aria-label={label}
        >
          <i style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      )}
      {/* « Terminé » est un état ACTIF : à la teinte franche, comme la coche « vu » des cartes. */}
      <span className={`shrink-0 text-xs font-medium tabular-nums ${stage === "watched" ? "text-accent" : "text-content-tertiary"}`}>
        {label}
      </span>
    </div>
  );
});
