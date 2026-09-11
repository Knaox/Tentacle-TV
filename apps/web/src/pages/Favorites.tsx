import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useBatchRemoveFavorites } from "@tentacle-tv/api-client";
import { CollectionGrid } from "../components/CollectionGrid";
import { CollectionHero } from "../components/collection/CollectionHero";
import { useCollectionFilters } from "../components/collection/useCollectionFilters";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
import { ShareMyListButton } from "../components/share/ShareMyListButton";
import { useMultiSelect } from "../hooks/useMultiSelect";

export function Favorites() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useFavoritesAll();
  const sel = useMultiSelect();
  const batchRemove = useBatchRemoveFavorites();
  const filteredIdsRef = useRef<string[]>([]);

  const handleFilteredIdsChange = useCallback((ids: string[]) => {
    filteredIdsRef.current = ids;
  }, []);

  // Les filtres de la bibliothèque, appliqués à cette liste — en mémoire, sans
  // toucher à la clé de cache qui porte l'ajout optimiste.
  const filters = useCollectionFilters(items, handleFilteredIdsChange);

  const handleDelete = () => {
    batchRemove.mutate([...sel.selected], { onSettled: () => sel.exitSelectionMode() });
  };

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        {/* La bannière remonte sous la barre de navigation, qui flotte alors
            transparente au-dessus du fond — même montage que l'accueil et la
            bibliothèque. */}
        <div className="-mt-[56px] md:-mt-[68px]">
          <CollectionHero
            title={t("common:myFavorites")}
            kicker={t("common:myFavorites")}
            items={items}
            subtitle={t("common:resultCount", { count: filters.resultCount })}
          />
        </div>

        <div className="relative z-10 -mt-10 md:-mt-14">
        <CollectionGrid
          title={t("common:myFavorites")}
          items={items}
          isLoading={isLoading}
          emptyMessage={t("common:emptyFavorites")}
          emptyHint={t("common:emptyFavoritesHint")}
          selectionMode={sel}
          onFilteredIdsChange={handleFilteredIdsChange}
          filters={filters}
          hideHeader
          searchName={t("common:myFavorites")}
          showFavorite={false}
          actions={
            !sel.isSelecting ? (
              <div className="flex items-center gap-2">
                {/* Le lien public des titres likés se gère ICI, sur la liste
                    elle-même — pas dans les réglages. */}
                <ShareMyListButton kind="likes" />
                {items && items.length > 0 && (
                  <button
                    onClick={sel.enterSelectionMode}
                    className="rounded-full bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-secondary"
                  >
                    {t("common:select")}
                  </button>
                )}
              </div>
            ) : undefined
          }
        />
        </div>
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
