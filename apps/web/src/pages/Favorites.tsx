import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useBatchRemoveFavorites } from "@tentacle-tv/api-client";
import { CollectionGrid } from "../components/CollectionGrid";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
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

  const handleDelete = () => {
    batchRemove.mutate([...sel.selected], { onSettled: () => sel.exitSelectionMode() });
  };

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        <CollectionGrid
          title={t("common:myFavorites")}
          items={items}
          isLoading={isLoading}
          emptyMessage={t("common:emptyFavorites")}
          emptyHint={t("common:emptyFavoritesHint")}
          selectionMode={sel}
          onFilteredIdsChange={handleFilteredIdsChange}
          actions={
            items && items.length > 0 && !sel.isSelecting ? (
              <button
                onClick={sel.enterSelectionMode}
                className="rounded-full bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-secondary"
              >
                {t("common:select")}
              </button>
            ) : undefined
          }
        />
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
