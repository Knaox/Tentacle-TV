import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { groupFavorites, summarizeFavorites, useBatchRemoveFavorites, useFavoritesAll } from "@tentacle-tv/api-client";
import { CollectionHero } from "../components/collection/CollectionHero";
import { CollectionGridBody } from "../components/collection/CollectionGridBody";
import { useCollectionFilters } from "../components/collection/useCollectionFilters";
import { LibraryGridEmpty } from "../components/library/LibraryGridEmpty";
import { FavoritesEmpty } from "../components/favorites/FavoritesEmpty";
import { FavoritesGroupedBody } from "../components/favorites/FavoritesGroupedBody";
import { FavoritesOverview } from "../components/favorites/FavoritesOverview";
import { FavoritesSkeleton } from "../components/favorites/FavoritesSkeleton";
import { FavoritesToolbar } from "../components/favorites/FavoritesToolbar";
import { useFavoritesGroupMode } from "../components/favorites/useFavoritesGroupMode";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
import { ShareMyListButton } from "../components/share/ShareMyListButton";
import { useMultiSelect } from "../hooks/useMultiSelect";

/**
 * Mes favoris — les titres likés.
 *
 * Bannière (le premier titre de la liste, zéro requête), puis le BILAN en
 * tuiles qui servent de filtres rapides (type et état de visionnage), la barre
 * de recherche / regroupement / filtres, et la grille — plate, ou découpée en
 * sections repliables (type, visionnage, genre, décennie). Tout se calcule en
 * mémoire sur `["favorites","all"]`, la clé du cache optimiste.
 *
 * ⚠️ Sur webOS, cette page est SUBSTITUÉE au build (`substitutionTable.ts`) :
 * rien de ce qui est importé ici n'y part, et l'export `Favorites` doit garder
 * son nom.
 */
export function Favorites() {
  const { t } = useTranslation(["common", "favorites"]);
  const { data: items, isLoading } = useFavoritesAll();
  const sel = useMultiSelect();
  const batchRemove = useBatchRemoveFavorites();
  const filteredIdsRef = useRef<string[]>([]);
  const { mode, setMode } = useFavoritesGroupMode();

  const handleFilteredIdsChange = useCallback((ids: string[]) => {
    filteredIdsRef.current = ids;
  }, []);

  const filters = useCollectionFilters(items, handleFilteredIdsChange);
  const groups = useMemo(() => (mode === "none" ? [] : groupFavorites(filters.filtered, mode)), [filters.filtered, mode]);
  const summary = useMemo(() => summarizeFavorites(items ?? []), [items]);

  const handleDelete = () => {
    batchRemove.mutate([...sel.selected], { onSettled: () => sel.exitSelectionMode() });
  };

  const resetAll = () => {
    filters.setInput("");
    filters.resetFilters();
    filters.setType("all");
  };

  const hours = Math.floor(summary.movieMinutes / 60);
  const subtitle = [
    t("common:itemCount", { count: summary.total }),
    hours > 0 ? t("favorites:summaryMovieHours", { count: hours }) : null,
  ].filter(Boolean).join(" · ");

  const title = t("common:myFavorites");
  const hasItems = !!items && items.length > 0;

  const actions = !sel.isSelecting ? (
    <div className="flex shrink-0 items-center gap-2">
      {/* Le lien public des titres likés se gère ICI, sur la liste elle-même. */}
      <ShareMyListButton kind="likes" />
      {hasItems && (
        <button
          onClick={sel.enterSelectionMode}
          className="h-9 cursor-pointer rounded-full bg-fill-subtle px-4 text-sm font-medium text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-secondary"
        >
          {t("common:select")}
        </button>
      )}
    </div>
  ) : undefined;

  let body;
  if (filters.filtered.length === 0) {
    body = (
      <LibraryGridEmpty
        filtered
        onReset={resetAll}
        query={filters.search}
        scopeName={title}
        onApplyQuery={filters.setInput}
      />
    );
  } else {
    const headerKey = `${filters.queryKey ?? ""}|${filters.type}|${mode}|${filters.filtered.length}|${actions ? 1 : 0}|${sel.isSelecting ? 1 : 0}`;
    body = mode === "none"
      ? <CollectionGridBody items={filters.filtered} selectionMode={sel} headerKey={headerKey} />
      : <FavoritesGroupedBody groups={groups} selectionMode={sel} headerKey={headerKey} />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        {isLoading ? (
          <FavoritesSkeleton />
        ) : !hasItems ? (
          <FavoritesEmpty extra={<ShareMyListButton kind="likes" />} />
        ) : (
          <>
            {/* La bannière remonte sous la barre de navigation, qui flotte alors
                transparente au-dessus du fond — même montage que l'accueil. */}
            <div className="-mt-[56px] md:-mt-[68px]">
              <CollectionHero title={title} kicker={t("favorites:kicker")} items={items} subtitle={subtitle} />
            </div>

            <div className="relative z-10 -mt-10 px-4 pt-6 md:-mt-14 md:px-8">
              <FavoritesOverview
                items={items}
                type={filters.type}
                status={filters.filters.statusFilter}
                onTypeChange={filters.setType}
                onStatusChange={filters.setStatusFilter}
              />
              <div className="mt-6">
                <FavoritesToolbar
                  filters={filters}
                  name={title}
                  groupMode={mode}
                  onGroupModeChange={setMode}
                  actions={actions}
                />
              </div>
              {body}
            </div>
          </>
        )}
      </div>

      {sel.isSelecting && (
        <SelectionToolbar
          count={sel.count}
          onSelectAll={() => sel.selectAll(filteredIdsRef.current)}
          onCancel={sel.exitSelectionMode}
          onDelete={handleDelete}
          isDeleting={batchRemove.isPending}
        />
      )}
    </PageTransition>
  );
}
