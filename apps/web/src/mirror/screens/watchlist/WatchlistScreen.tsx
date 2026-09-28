import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bookmark, CheckSquare, LayoutGrid, List } from "lucide-react";
import {
  filterByWatchStage,
  resumeQueue,
  summarizeWatchlist,
  useBatchRemoveWatchlist,
  useWatchlistAll,
  type WatchStageFilter,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMultiSelect } from "../../../hooks/useMultiSelect";
import { usePlayFromWatchlist, useRemovalUndo } from "../../../components/watchlist/useWatchlistActions";
import { useWatchlistView } from "../../../components/watchlist/useWatchlistView";
import { useSummaryLine } from "../../../components/watchlist/useSummaryLine";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import type { CardSheetTarget } from "../../cards/cardSheet";
import { GridSkeleton, ScopedSearchEmpty, ScrollTopFab, useBackOrHome } from "../../catalog";
import { CatalogEmpty } from "../../catalog/CatalogGridStates";
import { useGrid } from "../../useMirrorLayout";
import { CollectionControls, QuickChip } from "../collection/CollectionControls";
import { CollectionHero } from "../collection/CollectionHero";
import { CollectionNarrowEmpty, ListSkeleton } from "../collection/CollectionStates";
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
 * Ma liste sur petit écran (`screens/watchlist/WatchlistScreen` de l'app),
 * À LA FORME de la Bibliothèque : l'ambiance et le retour flottant, le titre
 * et son résumé chiffré, Partager et Sélectionner dessous ; puis le champ et
 * « Trier et filtrer », les étapes de visionnage (à la place du statut), la
 * barre rapide (type, tri, grille ou liste), « Reprendre », et la collection.
 * La grille reprend `SelectableGridCard` telle quelle ; la liste montre Lire
 * et Retirer.
 *
 * Mes favoris a son propre écran (`screens/favorites`).
 */
export function MirrorWatchlistScreen() {
  const { t } = useTranslation("common");
  const { t: tw } = useTranslation("watchlist");
  const navigate = useNavigate();
  const back = useBackOrHome();
  const { data: raw, isLoading } = useWatchlistAll();
  const batchRemove = useBatchRemoveWatchlist();
  const filters = useCollectionFilters(raw);
  const [stage, setStage] = useState<WatchStageFilter>("all");
  const { view, setView } = useWatchlistView();
  const selection = useMultiSelect();
  const [sheet, setSheet] = useState<CardSheetTarget | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
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
    if (!selection.isSelecting) setSheet({ kind: "media", variant: "poster", item });
  }, [selection.isSelecting]);
  // « Reprendre » se LANCE au toucher : sa feuille est celle d'une vignette 16:9.
  const handleResumeLongPress = useCallback((item: MediaItem) => setSheet({ kind: "media", variant: "landscape", item }), []);
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
    // À la forme de l'affichage choisi : l'écran ne saute pas à l'arrivée.
    body = view === "list" ? <ListSkeleton /> : <GridSkeleton rows={3} captions />;
  } else if (totalRaw === 0) {
    body = <WatchlistEmptyState />;
  } else if (data.length === 0) {
    body = stage !== "all" && filters.filtered.length > 0 ? (
      <CollectionNarrowEmpty message={tw(STAGE_EMPTY[stage])} actionLabel={tw("showAll")} onAction={() => setStage("all")} />
    ) : filters.state.search.length >= 2 ? (
      <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} />
    ) : (
      <CatalogEmpty filtered onReset={() => { filters.reset(); filters.patch({ type: "all" }); }} />
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
            item={item}
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
  const nextView = view === "grid" ? "list" : "grid";
  const NextViewIcon = nextView === "grid" ? LayoutGrid : List;
  return (
    <div className="pb-6">
      {/* Toujours là, même vide : il porte le retour. Sans titre, pas d'image. */}
      <CollectionHero
        items={raw}
        title={t("myList")}
        kicker={tw("kicker")}
        Icon={Bookmark}
        subtitle={hasContent ? summaryLine : ""}
        onBack={back}
        actions={hasContent && !selection.isSelecting ? (
          <>
            <ShareMyListButton kind="watchlist" />
            {data.length > 0 && (
              <QuickChip onClick={selection.enterSelectionMode}>
                <CheckSquare size={14} aria-hidden className="text-brand-light" />
                {t("select")}
              </QuickChip>
            )}
          </>
        ) : undefined}
      />
      {hasContent && !selection.isSelecting && (
        <CollectionControls
          filters={filters}
          name={t("myList")}
          lead={<StageBar stage={stage} onStageChange={setStage} counts={stageCounts} />}
          quick={
            <QuickChip onClick={() => setView(nextView)} label={tw(nextView === "grid" ? "viewGrid" : "viewList")}>
              <NextViewIcon size={16} aria-hidden />
            </QuickChip>
          }
        />
      )}
      {showResume && <ResumeRail items={resume} onPlay={play} onLongPress={handleResumeLongPress} pendingId={pendingId} />}
      {body}
      {hasContent && data.length > 0 && !selection.isSelecting && <ScrollTopFab />}
      <MediaActionSheet target={sheet} onClose={closeSheet} />
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
