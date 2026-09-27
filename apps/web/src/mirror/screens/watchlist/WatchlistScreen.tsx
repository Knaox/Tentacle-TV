import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bookmark } from "lucide-react";
import {
  filterByWatchStage,
  resumeQueue,
  summarizeWatchlist,
  useBatchRemoveWatchlist,
  useJellyfinClient,
  useWatchlistAll,
  type WatchStageFilter,
} from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { useMultiSelect } from "../../../hooks/useMultiSelect";
import { usePlayFromWatchlist, useRemovalUndo } from "../../../components/watchlist/useWatchlistActions";
import { useWatchlistView } from "../../../components/watchlist/useWatchlistView";
import { useSummaryLine } from "../../../components/watchlist/useSummaryLine";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import { GridSkeleton, ScopedSearchEmpty, ScrollTopFab, useBackOrHome } from "../../catalog";
import { useGrid } from "../../useMirrorLayout";
import { CollectionFilterHeader } from "../collection/CollectionFilterHeader";
import { ListHeader } from "../collection/ListHeader";
import { SelectableGridCard } from "../collection/SelectableGridCard";
import { SelectionBar } from "../collection/SelectionBar";
import { ShareMyListButton } from "../collection/ShareMyListButton";
import { useCollectionFilters } from "../collection/useCollectionFilters";
import { ResumeRail } from "./ResumeRail";
import { StageBar } from "./StageBar";
import { UndoBar, WatchlistEmptyState } from "./WatchlistFeedback";
import { WatchlistListRow } from "./WatchlistListRow";
import "../../mirror.css";

const STAGE_EMPTY = { new: "stageEmptyNew", inProgress: "stageEmptyInProgress", watched: "stageEmptyWatched" } as const;

/**
 * Ma liste sur petit écran (`screens/watchlist/WatchlistScreen` de l'app) :
 * en-tête chiffré, partage, « Reprendre », étapes de visionnage et bascule
 * grille / liste, filtres de collection, puis la collection. La grille reprend
 * `SelectableGridCard` telle quelle ; la liste montre Lire et Retirer.
 *
 * Mes favoris garde `CollectionScreen` : rien ici ne le touche.
 */
export function MirrorWatchlistScreen() {
  const { t } = useTranslation("common");
  const { t: tw } = useTranslation("watchlist");
  const navigate = useNavigate();
  const back = useBackOrHome();
  const client = useJellyfinClient();
  const { data: raw, isLoading } = useWatchlistAll();
  const batchRemove = useBatchRemoveWatchlist();
  const filters = useCollectionFilters(raw);
  const [stage, setStage] = useState<WatchStageFilter>("all");
  const { view, setView } = useWatchlistView();
  const selection = useMultiSelect();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheetId(null), []);
  const { play, pendingId } = usePlayFromWatchlist();
  const undo = useRemovalUndo();
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });

  const stageCounts = useMemo(() => summarizeWatchlist(filters.filtered), [filters.filtered]);
  const summaryLine = useSummaryLine(useMemo(() => summarizeWatchlist(raw ?? []), [raw]));
  const data = useMemo(() => filterByWatchStage(filters.filtered, stage), [filters.filtered, stage]);
  const resume = useMemo(() => resumeQueue(raw ?? []), [raw]);

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.isSelecting) selection.toggle(item.Id);
    else navigate(`/media/${item.Id}`);
  }, [navigate, selection]);
  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.isSelecting) setSheetId(item.Id);
  }, [selection.isSelecting]);
  const handleDelete = async () => {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.exitSelectionMode();
  };
  // « Tout sélectionner » porte sur ce qui est montré : filtres ET étape.
  const handleSelectAll = () => {
    if (selection.count === data.length) selection.selectAll([]);
    else selection.selectAll(data.map((i) => i.Id));
  };

  const totalRaw = raw?.length ?? 0;
  const isFiltered = filters.activeCount > 0 || filters.state.type !== "all" || filters.state.search.length >= 2;
  const showResume = !selection.isSelecting && stage === "all" && !isFiltered && resume.length > 0;

  let body: ReactNode;
  if (isLoading) {
    body = <GridSkeleton rows={3} />;
  } else if (totalRaw === 0) {
    body = <WatchlistEmptyState />;
  } else if (data.length === 0) {
    body = stage !== "all" && filters.filtered.length > 0 ? (
      <div className="flex flex-col items-center gap-3 px-6 pt-16 text-center">
        <p className="text-sm text-content-tertiary">{tw(STAGE_EMPTY[stage])}</p>
        <button type="button" onClick={() => setStage("all")} className="h-11 rounded-full bg-fill-subtle px-5 text-sm font-semibold text-content-secondary">
          {tw("showAll")}
        </button>
      </div>
    ) : filters.state.search.length >= 2 ? (
      <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} />
    ) : (
      <div className="flex flex-col items-center gap-2 px-4 pt-16 text-center">
        <p className="text-lg font-bold text-content-primary">{t("noResults")}</p>
        <p className="max-w-[280px] text-[13px] text-content-tertiary">{t("noResultsHint")}</p>
      </div>
    );
  } else if (view === "list") {
    body = (
      <div className="flex flex-col gap-2 px-4" style={{ paddingBottom: selection.isSelecting ? 132 : 0 }}>
        {data.map((item) => (
          <WatchlistListRow
            key={item.Id}
            item={item}
            selecting={selection.isSelecting}
            selected={selection.selected.has(item.Id)}
            pendingPlay={pendingId === item.Id}
            onPress={handlePress}
            onLongPress={handleLongPress}
            onPlay={play}
            onRemoved={undo.onRemoved}
          />
        ))}
      </div>
    );
  } else {
    body = (
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${numColumns}, ${itemWidth}px)`,
          columnGap: gutter,
          rowGap: 12,
          paddingLeft: padding,
          paddingRight: padding,
          paddingBottom: selection.isSelecting ? 132 : 0,
        }}
      >
        {data.map((item) => (
          <SelectableGridCard
            key={item.Id}
            posterUri={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
            title={item.Name}
            year={item.ProductionYear ?? null}
            progressPercent={item.UserData?.PlayedPercentage ?? null}
            watched={item.UserData?.Played === true}
            rating={cardRatingFor(item, "series").rating}
            width={itemWidth}
            selectable={selection.isSelecting}
            selected={selection.selected.has(item.Id)}
            onPress={() => handlePress(item)}
            onLongPress={() => handleLongPress(item)}
          />
        ))}
      </div>
    );
  }

  const hasContent = !isLoading && totalRaw > 0;
  return (
    <div className="pb-6">
      <ListHeader
        title={t("myList")}
        subtitle={hasContent ? summaryLine : ""}
        Icon={Bookmark}
        onBack={back}
        onEnterSelection={selection.enterSelectionMode}
        canSelect={data.length > 0 && !selection.isSelecting}
      />
      {hasContent && !selection.isSelecting && <div className="flex px-4 pb-3"><ShareMyListButton /></div>}
      {showResume && <ResumeRail items={resume} onPlay={play} pendingId={pendingId} />}
      {hasContent && !selection.isSelecting && (
        <>
          <StageBar stage={stage} onStageChange={setStage} counts={stageCounts} view={view} onViewChange={setView} />
          <CollectionFilterHeader filters={filters} />
        </>
      )}
      {body}
      {hasContent && data.length > 0 && !selection.isSelecting && <ScrollTopFab />}
      <MediaActionSheet itemId={sheetId} onClose={closeSheet} />
      {selection.isSelecting && (
        <SelectionBar
          count={selection.count}
          totalCount={data.length}
          onSelectAll={handleSelectAll}
          onDelete={() => void handleDelete()}
          onCancel={selection.exitSelectionMode}
          busy={batchRemove.isPending}
        />
      )}
      {undo.removed && <UndoBar item={undo.removed} onClose={undo.clear} />}
    </div>
  );
}
