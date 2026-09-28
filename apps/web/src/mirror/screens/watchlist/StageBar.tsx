import { memo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, List } from "lucide-react";
import { WATCH_STAGE_FILTERS, type WatchStageFilter, type WatchlistSummary } from "@tentacle-tv/api-client";
import type { WatchlistView } from "../../../components/watchlist/useWatchlistView";

const LABEL: Record<WatchStageFilter, string> = {
  all: "stageAll",
  new: "stageNew",
  inProgress: "stageInProgress",
  watched: "stageWatched",
};

const count = (s: WatchStageFilter, c: WatchlistSummary) => (s === "all" ? c.total : c[s]);

/**
 * Les étapes de visionnage en pastilles de 36 qui défilent sous le pouce, et
 * la bascule grille / liste en rond de 44 au bout. Une étape vide disparaît,
 * sauf l'active. Actif : dégradé de marque, compte en blanc.
 */
export const StageBar = memo(function StageBar({
  stage, onStageChange, counts, view, onViewChange,
}: {
  stage: WatchStageFilter;
  onStageChange: (s: WatchStageFilter) => void;
  counts: WatchlistSummary;
  view: WatchlistView;
  onViewChange: (v: WatchlistView) => void;
}) {
  const { t } = useTranslation("watchlist");
  const stages = WATCH_STAGE_FILTERS.filter((s) => s === "all" || s === stage || count(s, counts) > 0);
  const next: WatchlistView = view === "grid" ? "list" : "grid";
  const NextIcon = next === "grid" ? LayoutGrid : List;

  return (
    <div className="flex items-center gap-2 pb-2 pl-4 pr-4">
      <div
        role="radiogroup"
        aria-label={t("stageFilterLabel")}
        className="mirror-no-scrollbar -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
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
              className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
                active ? "text-white" : "border border-line-subtle bg-fill-subtle text-content-secondary"
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
      <button
        type="button"
        onClick={() => onViewChange(next)}
        aria-label={t(next === "grid" ? "viewGrid" : "viewList")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-fill-subtle text-content-secondary"
      >
        <NextIcon size={18} aria-hidden />
      </button>
    </div>
  );
});
