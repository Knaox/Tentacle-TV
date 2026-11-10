import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SquaresFourIcon as LayoutGrid } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { ListIcon as List } from "@phosphor-icons/react/dist/csr/List";
import {
  WATCH_STAGE_FILTERS,
  type CollectionTypeTab,
  type WatchStageFilter,
  type WatchlistSummary,
} from "@tentacle-tv/api-client";
import { SegmentedControl } from "../library/SegmentedControl";
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

/**
 * Les étapes de visionnage, avec leur compte, dans le contrôle segmenté de la
 * Bibliothèque — à la place de son statut, qu'elles remplacent. Une étape
 * vide disparaît, sauf l'active, qu'on doit pouvoir voir et quitter.
 */
export const StageSegment = memo(function StageSegment({
  stage, onStageChange, counts,
}: {
  stage: WatchStageFilter;
  onStageChange: (stage: WatchStageFilter) => void;
  counts: WatchlistSummary;
}) {
  const { t } = useTranslation("watchlist");
  const options = useMemo(
    () => WATCH_STAGE_FILTERS
      .filter((s) => s === "all" || s === stage || countFor(s, counts) > 0)
      .map((s) => ({ value: s, label: t(STAGE_LABEL[s]), count: countFor(s, counts) })),
    [stage, counts, t],
  );
  return (
    <SegmentedControl
      label={t("stageFilterLabel")}
      markerId="watchlist-stage-marker"
      options={options}
      value={stage}
      onChange={onStageChange}
    />
  );
});

/** Tous / Films / Séries — un second segmenté, sans compte. */
export const TypeSegment = memo(function TypeSegment({
  tabs, type, onTypeChange,
}: {
  tabs: { key: CollectionTypeTab; label: string }[];
  type: CollectionTypeTab;
  onTypeChange: (type: CollectionTypeTab) => void;
}) {
  const { t } = useTranslation("watchlist");
  const options = useMemo(() => tabs.map((tab) => ({ value: tab.key, label: tab.label })), [tabs]);
  return (
    <SegmentedControl
      label={t("typeFilterLabel")}
      markerId="watchlist-type-marker"
      options={options}
      value={type}
      onChange={onTypeChange}
    />
  );
});

/** Grille ou liste, en icônes — au trait au repos, PLEINE pour la vue retenue. */
export const ViewToggle = memo(function ViewToggle({
  view, onViewChange,
}: {
  view: WatchlistView;
  onViewChange: (view: WatchlistView) => void;
}) {
  const { t } = useTranslation("watchlist");
  const options = useMemo(() => [
    { value: "grid" as const, label: t("viewGrid"), icon: <LayoutGrid size={16} weight={view === "grid" ? "fill" : "regular"} aria-hidden /> },
    { value: "list" as const, label: t("viewList"), icon: <List size={16} weight={view === "list" ? "bold" : "regular"} aria-hidden /> },
  ], [t, view]);
  return (
    <SegmentedControl
      label={t("viewLabel")}
      markerId="watchlist-view-marker"
      options={options}
      value={view}
      onChange={onViewChange}
    />
  );
});
