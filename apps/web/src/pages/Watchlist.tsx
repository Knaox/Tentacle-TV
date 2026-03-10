import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useWatchlistAll, useAppConfig, useBatchRemoveWatchlist } from "@tentacle-tv/api-client";
import { CollectionGrid } from "../components/CollectionGrid";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { PageTransition } from "../components/PageTransition";
import { CreateSharedWatchlistModal } from "../components/CreateSharedWatchlistModal";
import { SharedWatchlists } from "../components/SharedWatchlists";
import { useMultiSelect } from "../hooks/useMultiSelect";

export function Watchlist() {
  const { t } = useTranslation("common");
  const { data: items, isLoading } = useWatchlistAll();
  const { data: config } = useAppConfig();
  const [createOpen, setCreateOpen] = useState(false);
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
            items && items.length > 0 && !sel.isSelecting ? (
              <button
                onClick={sel.enterSelectionMode}
                className="rounded-full bg-white/5 px-3 py-1.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
              >
                {t("common:select")}
              </button>
            ) : undefined
          }
        />

        {config?.features.sharedWatchlists && (
          <div className="px-4 md:px-12">
            <div className="mb-6 mt-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{t("common:mySharedLists")}</h2>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2 text-sm font-medium text-purple-300 ring-1 ring-purple-500/20 transition-all hover:from-purple-500/20 hover:to-pink-500/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t("common:createSharedList")}
              </button>
            </div>
            <SharedWatchlists />
          </div>
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

      {createOpen && config?.features.sharedWatchlists && (
        <CreateSharedWatchlistModal onClose={() => setCreateOpen(false)} />
      )}
    </PageTransition>
  );
}
