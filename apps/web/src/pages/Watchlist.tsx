import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useWatchlistAll, useBatchRemoveWatchlist } from "@tentacle-tv/api-client";
import { CollectionGrid } from "../components/CollectionGrid";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
import { ShareMyListButton } from "../components/share/ShareMyListButton";
import { useMultiSelect } from "../hooks/useMultiSelect";

export function Watchlist() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useWatchlistAll();
  const sel = useMultiSelect();
  const batchRemove = useBatchRemoveWatchlist();
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
          title={t("common:myList")}
          items={items}
          isLoading={isLoading}
          emptyMessage={t("common:emptyWatchlist")}
          emptyHint={t("common:emptyWatchlistHint")}
          emptyIcon={<span>&#128278;</span>}
          selectionMode={sel}
          onFilteredIdsChange={handleFilteredIdsChange}
          actions={
            !sel.isSelecting ? (
              <div className="flex items-center gap-2">
                <ShareMyListButton />
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
