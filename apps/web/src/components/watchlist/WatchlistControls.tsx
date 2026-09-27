import { memo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, List } from "lucide-react";
import {
  WATCH_STAGE_FILTERS,
  type CollectionTypeTab,
  type WatchStageFilter,
  type WatchlistSummary,
} from "@tentacle-tv/api-client";
import type { WatchlistView } from "./useWatchlistPage";

const STAGE_LABEL: Record<WatchStageFilter, string> = {
  all: "stageAll",
  new: "stageNew",
  inProgress: "stageInProgress",
  watched: "stageWatched",
};

function countFor(stage: WatchStageFilter, counts: WatchlistSummary): number {
  return stage === "all" ? counts.total : counts[stage];
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/**
 * Les étapes de visionnage, avec leur compte. Une étape vide disparaît — sauf
 * l'active, qu'on doit pouvoir voir et quitter. Sur écran étroit, la rangée
 * défile horizontalement plutôt que de passer à la ligne.
 */
export const StageChips = memo(function StageChips({
  stage, onStageChange, counts,
}: {
  stage: WatchStageFilter;
  onStageChange: (stage: WatchStageFilter) => void;
  counts: WatchlistSummary;
}) {
  const { t } = useTranslation("watchlist");
  const stages = WATCH_STAGE_FILTERS.filter((s) => s === "all" || s === stage || countFor(s, counts) > 0);

  return (
    <div role="radiogroup" aria-label={t("stageFilterLabel")} className="flex items-center gap-1.5">
      {stages.map((s) => {
        const active = s === stage;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onStageChange(s)}
            className={`flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${FOCUS} ${
              active ? "text-white" : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
            }`}
            style={active ? { background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" } : undefined}
          >
            {t(STAGE_LABEL[s])}
            <span
              className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                active ? "bg-black/20 text-white" : "bg-fill-soft text-content-quaternary"
              }`}
            >
              {countFor(s, counts)}
            </span>
          </button>
        );
      })}
    </div>
  );
});

/** Tous / Films / Séries — en segment, pour ne pas ressembler aux étapes. */
export const TypeSegment = memo(function TypeSegment({
  tabs, type, onTypeChange,
}: {
  tabs: { key: CollectionTypeTab; label: string }[];
  type: CollectionTypeTab;
  onTypeChange: (type: CollectionTypeTab) => void;
}) {
  return (
    <div role="radiogroup" className="flex shrink-0 items-center rounded-full border border-line-subtle bg-fill-faint p-1">
      {tabs.map((tab) => {
        const active = tab.key === type;
        return (
          <button
            key={tab.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onTypeChange(tab.key)}
            className={`h-7 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${FOCUS} ${
              active ? "bg-fill-medium text-content-primary" : "text-content-quaternary hover:text-content-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

/** Grille ou liste. */
export const ViewToggle = memo(function ViewToggle({
  view, onViewChange,
}: {
  view: WatchlistView;
  onViewChange: (view: WatchlistView) => void;
}) {
  const { t } = useTranslation("watchlist");
  return (
    <div
      role="radiogroup"
      aria-label={t("viewLabel")}
      className="flex shrink-0 items-center rounded-full border border-line-subtle bg-fill-faint p-1"
    >
      {(["grid", "list"] as const).map((v) => {
        const active = v === view;
        const Icon = v === "grid" ? LayoutGrid : List;
        const label = t(v === "grid" ? "viewGrid" : "viewList");
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => onViewChange(v)}
            className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ${FOCUS} ${
              active ? "bg-fill-medium text-content-primary" : "text-content-quaternary hover:text-content-primary"
            }`}
          >
            <Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
});
