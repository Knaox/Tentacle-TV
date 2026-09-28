import { memo } from "react";
import { useTranslation } from "react-i18next";
import { WATCH_STAGE_FILTERS, type WatchStageFilter, type WatchlistSummary } from "@tentacle-tv/api-client";

const LABEL: Record<WatchStageFilter, string> = {
  all: "stageAll",
  new: "stageNew",
  inProgress: "stageInProgress",
  watched: "stageWatched",
};

const count = (s: WatchStageFilter, c: WatchlistSummary) => (s === "all" ? c.total : c[s]);

/**
 * Les étapes de visionnage (`watchlist/StageBar` de l'app), entre le champ et
 * la barre rapide — là où la Bibliothèque pose son statut. Pastilles de 36 qui
 * défilent sous le pouce, à la peau de la barre rapide (`surface.s1`, liseré
 * fort) ; l'active prend le dégradé de marque, compte en blanc. Une étape vide
 * disparaît, sauf l'active.
 */
export const StageBar = memo(function StageBar({
  stage, onStageChange, counts,
}: {
  stage: WatchStageFilter;
  onStageChange: (s: WatchStageFilter) => void;
  counts: WatchlistSummary;
}) {
  const { t } = useTranslation("watchlist");
  const stages = WATCH_STAGE_FILTERS.filter((s) => s === "all" || s === stage || count(s, counts) > 0);

  return (
    <div
      role="radiogroup"
      aria-label={t("stageFilterLabel")}
      className="mirror-no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 pt-2"
    >
      {stages.map((s) => {
        const active = s === stage;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onStageChange(s)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-transform duration-100 active:scale-[0.97] ${
              active ? "text-white" : "border border-line-strong bg-surface-1 text-content-secondary"
            }`}
            style={active ? { background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" } : undefined}
          >
            {t(LABEL[s])}
            <span className={`text-[11px] font-bold tabular-nums ${active ? "text-white/85" : "text-content-quaternary"}`}>
              {count(s, counts)}
            </span>
          </button>
        );
      })}
    </div>
  );
});
