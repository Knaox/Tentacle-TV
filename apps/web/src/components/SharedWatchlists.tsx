import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useMySharedWatchlists,
  useSharedWatchlistItems,
  useDeleteSharedWatchlist,
  useRemoveMember,
  useToggleWatchlist,
  useFavorite,
  useJellyfinClient,
  useBatchRemoveSharedItems,
  type SharedWatchlistSummary,
  type SharedWatchlistItemData,
} from "@tentacle-tv/api-client";
import { AddMediaModal } from "./AddMediaModal";
import { ManageMembersModal } from "./ManageMembersModal";
import { MediaContextMenu } from "./MediaContextMenu";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { SelectionToolbar } from "./SelectionToolbar";
import { useMultiSelect } from "../hooks/useMultiSelect";

export function SharedWatchlists() {
  const { data: lists } = useMySharedWatchlists();
  if (!lists || lists.length === 0) return null;
  return (
    <div className="space-y-6">
      {lists.map((list) => (<SharedListSection key={list.id} list={list} />))}
    </div>
  );
}

function SharedListSection({ list }: { list: SharedWatchlistSummary }) {
  const { t } = useTranslation("common");
  const deleteList = useDeleteSharedWatchlist();
  const { data: items, isLoading } = useSharedWatchlistItems(list.id);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [hideWatched, setHideWatched] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCreator = list.myRole === "creator";
  const canAdd = isCreator || list.myRole === "contributor";
  const roleBadge = isCreator ? t("common:creator") : list.myRole === "contributor" ? t("common:contributor") : t("common:reader");
  const roleBadgeClass = isCreator
    ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 ring-1 ring-purple-500/30"
    : list.myRole === "contributor"
    ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
    : "bg-white/10 text-white/50 ring-1 ring-white/10";

  const visibleItems = useMemo(() => {
    if (!items) return [];
    return hideWatched ? items.filter((i) => !i.userData?.played) : items;
  }, [items, hideWatched]);
  const hiddenCount = (items?.length ?? 0) - visibleItems.length;
  const handleDelete = () => { if (!confirmDelete) { setConfirmDelete(true); return; } deleteList.mutate(list.id); };

  const sel = useMultiSelect();
  const batchRemove = useBatchRemoveSharedItems(list.id);

  const handleBatchDelete = () => {
    batchRemove.mutate([...sel.selected], { onSettled: () => sel.exitSelectionMode() });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
            {list.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">{list.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass}`}>{roleBadge}</span>
            </div>
            <p className="text-xs text-white/30">
              {t("common:createdBy", { name: isCreator ? t("common:you") : list.creatorUsername })}
              {" · "}{t("common:memberCount", { count: list.memberCount })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCreator && !sel.isSelecting && visibleItems.length > 0 && (
            <button onClick={sel.enterSelectionMode}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white/70">
              {t("common:select")}
            </button>
          )}
          {canAdd && (
            <button onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 ring-1 ring-purple-500/20 transition-all hover:bg-purple-500/20">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t("common:addMedia")}
            </button>
          )}
          {isCreator && (
            <button onClick={() => setMembersModalOpen(true)}
              className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-purple-500/10 hover:text-purple-400"
              title={t("common:manageMembers")}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            </button>
          )}
          {isCreator ? (
            <button onClick={handleDelete} disabled={deleteList.isPending}
              className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title={confirmDelete ? t("common:confirmDeleteList") : t("common:deleteList")}>
              <svg className={`h-4 w-4 ${confirmDelete ? "text-red-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          ) : (<LeaveButton listId={list.id} />)}
        </div>
      </div>
      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 px-5 pb-2">
          <button onClick={() => setHideWatched(!hideWatched)} className="text-xs text-white/30 hover:text-white/50">
            {hideWatched ? `${hiddenCount} ${t("common:watchedHidden")} — ${t("common:showMore")}` : t("common:showLess")}
          </button>
        </div>
      )}
      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-white/5" />))}
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">{t("common:emptyWatchlist")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {visibleItems.map((item) => (
              <SharedItemCard
                key={item.id}
                item={item}
                isSelecting={sel.isSelecting}
                isSelected={sel.isSelected(item.id)}
                onToggleSelect={() => sel.toggle(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {sel.isSelecting && (
        <SelectionToolbar
          count={sel.count}
          onSelectAll={() => sel.selectAll(visibleItems.map((i) => i.id))}
          onCancel={sel.exitSelectionMode}
          onDelete={handleBatchDelete}
          isDeleting={batchRemove.isPending}
        />
      )}

      {addModalOpen && <AddMediaModal watchlistId={list.id} watchlistName={list.name} onClose={() => setAddModalOpen(false)} />}
      {membersModalOpen && <ManageMembersModal watchlistId={list.id} watchlistName={list.name} onClose={() => setMembersModalOpen(false)} />}
    </div>
  );
}

function LeaveButton({ listId }: { listId: string }) {
  const { t } = useTranslation("common");
  const removeMember = useRemoveMember(listId);
  const handleLeave = async () => {
    const token = localStorage.getItem("tentacle_token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/shared-watchlists/${listId}/members`, { headers, credentials: token ? undefined : "include" });
    if (!res.ok) return;
    const members = await res.json();
    const userStr = localStorage.getItem("tentacle_user");
    if (!userStr) return;
    const self = members.find((m: { userId: string }) => m.userId === JSON.parse(userStr).Id);
    if (self) removeMember.mutate(self.id);
  };
  return (
    <button onClick={handleLeave} disabled={removeMember.isPending}
      className="shrink-0 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
      title={t("common:leaveList")}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
    </button>
  );
}

function SharedItemCard({ item, isSelecting, isSelected, onToggleSelect }: {
  item: SharedWatchlistItemData;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localFavorite, setLocalFavorite] = useState(item.userData?.isFavorite === true);
  const [localWatchlist, setLocalWatchlist] = useState(item.userData?.likes === true);
  useEffect(() => { setLocalFavorite(item.userData?.isFavorite === true); }, [item.userData?.isFavorite]);
  useEffect(() => { setLocalWatchlist(item.userData?.likes === true); }, [item.userData?.likes]);

  const { add: addFav, remove: removeFav } = useFavorite(item.jellyfinItemId);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(item.jellyfinItemId);

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }, []);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => setCtxMenu(pos), 500);
  }, []);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  return (
    <div
      onClick={() => {
        if (isSelecting) { onToggleSelect(); return; }
        if (!ctxMenu) navigate(`/media/${item.jellyfinItemId}`);
      }}
      onContextMenu={isSelecting ? undefined : handleContextMenu}
      onTouchStart={isSelecting ? undefined : handleTouchStart}
      onTouchEnd={isSelecting ? undefined : clearLongPress}
      onTouchMove={isSelecting ? undefined : clearLongPress}
      className={`group relative cursor-pointer ${isSelected ? "ring-2 ring-purple-500 rounded-lg" : ""}`}
    >
      {isSelecting && (
        <SelectionCheckbox checked={isSelected} onClick={onToggleSelect} />
      )}
      <div className="overflow-hidden rounded-lg transition-transform group-hover:scale-105">
        <img
          src={client.getImageUrl(item.jellyfinItemId, "Primary", { height: 300, quality: 80 })}
          alt={item.name} className="aspect-[2/3] w-full object-cover" loading="lazy"
        />
        {item.userData?.played && (
          <div className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-green-400">{t("common:watched")}</div>
        )}
        {/* Hover action buttons */}
        <div className={`absolute right-1 top-1 z-10 flex flex-col gap-1 transition-opacity ${isSelecting ? "hidden" : "opacity-0 group-hover:opacity-100"}`}
          style={{ pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }} className="flex flex-col gap-1">
            <button className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={(e) => { e.stopPropagation(); setLocalFavorite(!localFavorite); if (localFavorite) removeFav.mutate(); else addFav.mutate(); }}>
              {localFavorite
                ? <svg className="h-3 w-3 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                : <svg className="h-3 w-3 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>}
            </button>
            <button className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={(e) => { e.stopPropagation(); setLocalWatchlist(!localWatchlist); if (localWatchlist) removeWatchlist.mutate(); else addWatchlist.mutate(); }}>
              {localWatchlist
                ? <svg className="h-3 w-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
                : <svg className="h-3 w-3 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>}
            </button>
          </div>
        </div>
      </div>
      <p className="mt-1 truncate text-xs text-white/40">{t("common:addedBy", { name: item.addedByUsername })}</p>
      {!isSelecting && ctxMenu && (
        <MediaContextMenu
          itemId={item.jellyfinItemId} isFavorite={localFavorite} isInWatchlist={localWatchlist}
          x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onToggleFavorite={() => setLocalFavorite(!localFavorite)}
          onToggleWatchlist={() => setLocalWatchlist(!localWatchlist)}
        />
      )}
    </div>
  );
}
