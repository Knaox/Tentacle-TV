import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWatchlistAll, useBatchRemoveWatchlist } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionHero } from "../components/collection/CollectionHero";
import { CollectionGridBody } from "../components/collection/CollectionGridBody";
import { LibraryGridEmpty } from "../components/library/LibraryGridEmpty";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { useWatchlistPage } from "../components/watchlist/useWatchlistPage";
import { usePlayFromWatchlist, useRemovalUndo } from "../components/watchlist/useWatchlistActions";
import { CollectionActions } from "../components/collection/CollectionActions";
import { CollectionToolbarPanel } from "../components/collection/CollectionToolbarPanel";
import { CollectionSkeleton } from "../components/collection/CollectionStates";
import { StageSegment, TypeSegment, ViewToggle } from "../components/watchlist/WatchlistControls";
import { WatchlistResumeShelf } from "../components/watchlist/WatchlistResumeShelf";
import { WatchlistListBody } from "../components/watchlist/WatchlistListBody";
import { WatchlistEmpty, WatchlistStageEmpty } from "../components/watchlist/WatchlistStates";
import { WatchlistUndoToast } from "../components/watchlist/WatchlistUndoToast";
import { useSummaryLine } from "../components/watchlist/useSummaryLine";

/**
 * Ma liste — bureau et web grand écran.
 *
 * La grammaire de la Bibliothèque : la bannière (sujet = premier titre,
 * résumé chiffré), puis le MÊME panneau d'outils qui la chevauche — recherche,
 * compte, tri, et au bout partager / sélectionner / grille ou liste ; à
 * l'étage du bas, les étapes de visionnage et le type à la place du statut,
 * puis les menus de filtres. Sous le panneau, ce qui n'appartient qu'à Ma
 * liste : la file « Reprendre », puis la collection. La grille reprend telles
 * quelles les cartes du catalogue ; la liste montre la progression et les
 * gestes Lire / Retirer sans survol.
 */
export function Watchlist() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: items, isLoading } = useWatchlistAll();
  const page = useWatchlistPage(items);
  const { filters, stage, visible } = page;
  const sel = useMultiSelect();
  const batchRemove = useBatchRemoveWatchlist();
  const { play, pendingId } = usePlayFromWatchlist();
  const undo = useRemovalUndo();

  const openItem = useCallback((item: MediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  const showAll = useCallback(() => page.setStage("all"), [page]);

  const handleDelete = () => {
    batchRemove.mutate([...sel.selected], { onSettled: () => sel.exitSelectionMode() });
  };

  const summaryLine = useSummaryLine(page.summary);

  const hasItems = (items?.length ?? 0) > 0;
  const showResume = hasItems && stage === "all" && !filters.isFiltered && !sel.isSelecting;
  const headerKey = `${filters.queryKey ?? ""}|${filters.type}|${stage}|${page.view}|${visible.length}|${sel.isSelecting ? 1 : 0}|${showResume ? page.resume.length : 0}`;

  const actions = !sel.isSelecting ? (
    <CollectionActions
      shareKind="watchlist"
      onSelect={visible.length > 0 ? sel.enterSelectionMode : undefined}
      extra={<ViewToggle view={page.view} onViewChange={page.setView} />}
    />
  ) : undefined;

  let body: ReactNode;
  if (visible.length > 0) {
    body = page.view === "list" ? (
      <WatchlistListBody
        items={visible}
        onOpen={openItem}
        onPlay={play}
        pendingPlayId={pendingId}
        onRemoved={undo.onRemoved}
        selectionMode={sel}
        headerKey={headerKey}
      />
    ) : (
      <CollectionGridBody items={visible} selectionMode={sel} headerKey={headerKey} />
    );
  } else if (stage !== "all" && filters.filtered.length > 0) {
    body = <WatchlistStageEmpty stage={stage} onShowAll={showAll} />;
  } else {
    body = (
      <LibraryGridEmpty
        filtered
        onReset={() => { filters.setInput(""); filters.resetFilters(); page.setStage("all"); }}
        query={filters.search}
        scopeName={t("common:myList")}
        onApplyQuery={filters.setInput}
      />
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        {isLoading ? (
          <CollectionSkeleton view={page.view} label={t("common:myList")} />
        ) : !hasItems ? (
          <WatchlistEmpty />
        ) : (
          <>
            {/* La bannière remonte sous la barre de navigation, qui flotte
                alors transparente au-dessus du fond — même montage que
                l'accueil et la bibliothèque. */}
            <div className="-mt-[56px] md:-mt-[68px]">
              <CollectionHero title={t("common:myList")} kicker={t("common:myList")} items={items} subtitle={summaryLine} />
            </div>

            <div className="relative z-10 -mt-10 px-4 pt-6 md:-mt-14 md:px-8">
              <div className="mb-6">
                <CollectionToolbarPanel
                  filters={filters}
                  name={t("common:myList")}
                  actions={actions}
                  segment={
                    <>
                      <StageSegment stage={stage} onStageChange={page.setStage} counts={page.stageCounts} />
                      <TypeSegment tabs={filters.tabs} type={filters.type} onTypeChange={filters.setType} />
                    </>
                  }
                />
              </div>
              {showResume && <WatchlistResumeShelf items={page.resume} onPlay={play} pendingPlayId={pendingId} />}
              {body}
            </div>
          </>
        )}
      </div>

      {sel.isSelecting && (
        <SelectionToolbar
          count={sel.count}
          onSelectAll={() => sel.selectAll(visible.map((i) => i.Id))}
          onCancel={sel.exitSelectionMode}
          onDelete={handleDelete}
          isDeleting={batchRemove.isPending}
        />
      )}
      {undo.removed && <WatchlistUndoToast item={undo.removed} onClose={undo.clear} />}
    </PageTransition>
  );
}
