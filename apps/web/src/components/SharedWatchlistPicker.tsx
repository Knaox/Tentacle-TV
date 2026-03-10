import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMySharedWatchlists,
  useToggleWatchlist,
  useBatchAddToSharedWatchlists,
  useCreateSharedWatchlist,
  type SharedWatchlistItemData,
} from "@tentacle-tv/api-client";

interface Props {
  itemId: string;
  onDone: () => void;
  onSuccess?: () => void;
}

export function SharedWatchlistPicker({ itemId, onDone, onSuccess }: Props) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const { data: lists, isLoading } = useMySharedWatchlists();
  const batchAdd = useBatchAddToSharedWatchlists();
  const { add: addToMyList } = useToggleWatchlist(itemId);
  const createList = useCreateSharedWatchlist();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [alsoMyList, setAlsoMyList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Only show lists where user can add (creator or contributor)
  const writableLists = (lists ?? []).filter(
    (l) => l.myRole === "creator" || l.myRole === "contributor"
  );

  // Check cache: which lists already contain this item?
  const alreadyInLists = useMemo(() => {
    const set = new Set<string>();
    for (const list of writableLists) {
      if (justAdded.has(list.id)) { set.add(list.id); continue; }
      const cached = qc.getQueryData<SharedWatchlistItemData[]>(["sw", "items", list.id]);
      if (cached?.some((i) => i.jellyfinItemId === itemId)) set.add(list.id);
    }
    return set;
  }, [writableLists, itemId, qc, justAdded]);

  const toggleList = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = () => {
    // Exclude lists that already contain this item
    const newIds = [...selected].filter((id) => !alreadyInLists.has(id));
    const hasNew = newIds.length > 0;
    if (hasNew) {
      batchAdd.mutate(
        { jellyfinItemId: itemId, watchlistIds: newIds },
        {
          onSuccess: () => {
            setJustAdded((prev) => { const next = new Set(prev); newIds.forEach((id) => next.add(id)); return next; });
            onSuccess?.();
          },
          onSettled: onDone,
        }
      );
    }
    if (alsoMyList) {
      addToMyList.mutate(undefined, { onSettled: hasNew ? undefined : onDone });
    }
    if (!hasNew && !alsoMyList) {
      onDone();
    }
  };

  const handleCreateInline = () => {
    if (!newName.trim()) return;
    createList.mutate(
      { name: newName.trim() },
      {
        onSuccess: (created) => {
          setSelected((prev) => new Set(prev).add(created.id));
          setCreating(false);
          setNewName("");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  return (
    <div className="max-h-[250px] overflow-y-auto px-4 py-3">
      {writableLists.length === 0 && !creating ? (
        <div className="space-y-2">
          <p className="text-xs text-white/30">{t("common:noSharedLists")}</p>
          <button
            onClick={() => setCreating(true)}
            className="text-xs font-medium text-purple-400 hover:text-purple-300"
          >
            {t("common:createFirstList")}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {writableLists.map((list) => {
            const alreadyIn = alreadyInLists.has(list.id);
            return (
              <label
                key={list.id}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${alreadyIn ? "opacity-50" : "cursor-pointer hover:bg-white/5"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(list.id) || alreadyIn}
                  disabled={alreadyIn}
                  onChange={() => !alreadyIn && toggleList(list.id)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30 disabled:opacity-50"
                />
                <span className="flex-1 truncate text-xs text-white/70">{list.name}</span>
                <span className="text-[10px] text-white/30">
                  {list.itemCount}
                </span>
              </label>
            );
          })}

          <div className="border-t border-white/5 pt-1.5">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
              <input
                type="checkbox"
                checked={alsoMyList}
                onChange={() => setAlsoMyList(!alsoMyList)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30"
              />
              <span className="flex-1 text-xs text-white/70">{t("common:alsoAddToMyList")}</span>
            </label>
          </div>

          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t("common:createList")}
            </button>
          ) : (
            <div className="mt-1 flex gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateInline()}
                placeholder={t("common:listNamePlaceholder")}
                className="flex-1 rounded bg-white/5 px-2 py-1 text-xs text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-purple-500/50"
              />
              <button
                onClick={handleCreateInline}
                disabled={!newName.trim() || createList.isPending}
                className="rounded bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/30 disabled:opacity-40"
              >
                OK
              </button>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={[...selected].filter((id) => !alreadyInLists.has(id)).length === 0 && !alsoMyList}
            className="mt-2 w-full rounded-lg bg-purple-500/20 py-2 text-xs font-medium text-purple-300 ring-1 ring-purple-500/30 transition-all hover:bg-purple-500/30 disabled:opacity-30"
          >
            {t("common:confirm")}
          </button>
        </div>
      )}
    </div>
  );
}
