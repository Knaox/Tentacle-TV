import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useToggleWatchlist, useFavorite } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { SelectionCheckbox } from "./SelectionCheckbox";

type FilterTab = "all" | "Movie" | "Series";

export interface SelectionMode {
  isSelecting: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
}

interface CollectionGridProps {
  title: string;
  items: MediaItem[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: ReactNode;
  actions?: ReactNode;
  selectionMode?: SelectionMode;
  onFilteredIdsChange?: (ids: string[]) => void;
}

export function CollectionGrid({
  title, items, isLoading, emptyMessage, emptyHint, emptyIcon, actions, selectionMode, onFilteredIdsChange,
}: CollectionGridProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = items?.filter((item) => filter === "all" || item.Type === filter);

  const filteredIdsRef = useRef<string[]>([]);
  const filteredIds = filtered?.map((i) => i.Id) ?? [];
  if (filteredIds.join(",") !== filteredIdsRef.current.join(",")) {
    filteredIdsRef.current = filteredIds;
  }
  useEffect(() => {
    onFilteredIdsChange?.(filteredIdsRef.current);
  }, [filteredIdsRef.current, onFilteredIdsChange]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("common:allFilter") },
    { key: "Movie", label: t("common:moviesFilter") },
    { key: "Series", label: t("common:seriesFilter") },
  ];

  return (
    <div className="px-4 pt-6 md:px-12">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white truncate">{title}</h1>
      </div>

      {/* Filter tabs + actions */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === tab.key
                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {actions && (
          <div className="ml-auto flex items-center gap-2 sm:ml-auto">{actions}</div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          {emptyIcon && <div className="mb-4 text-5xl opacity-40">{emptyIcon}</div>}
          <p className="text-lg text-white/40">{emptyMessage}</p>
          {emptyHint && <p className="mt-2 text-sm text-white/25">{emptyHint}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {filtered.map((item, i) => (
            <CollectionGridCard key={item.Id} item={item} index={i} selectionMode={selectionMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionGridCard({ item, index, selectionMode }: { item: MediaItem; index: number; selectionMode?: SelectionMode }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelecting = selectionMode?.isSelecting ?? false;
  const isSelected = selectionMode?.isSelected(item.Id) ?? false;

  const [localFavorite, setLocalFavorite] = useState(item.UserData?.IsFavorite === true);
  const [localWatchlist, setLocalWatchlist] = useState(item.UserData?.Likes === true);
  useEffect(() => { setLocalFavorite(item.UserData?.IsFavorite === true); }, [item.UserData?.IsFavorite]);
  useEffect(() => { setLocalWatchlist(item.UserData?.Likes === true); }, [item.UserData?.Likes]);

  const { add: addFav, remove: removeFav } = useFavorite(item.Id);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(item.Id);

  const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
  const progress = item.UserData?.PlayedPercentage;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);
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
        if (isSelecting) { selectionMode?.toggle(item.Id); return; }
        if (!ctxMenu) navigate(`/media/${item.Id}`);
      }}
      onContextMenu={isSelecting ? undefined : handleContextMenu}
      onTouchStart={isSelecting ? undefined : handleTouchStart}
      onTouchEnd={isSelecting ? undefined : clearLongPress}
      onTouchMove={isSelecting ? undefined : clearLongPress}
      className={`group relative cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-all duration-300 hover:scale-[1.03] ${
        isSelected ? "ring-2 ring-purple-500" : ""
      }`}
      style={{ animation: `fadeSlideUp 0.5s ease both`, animationDelay: `${index * 40}ms` }}
    >
      {isSelecting && (
        <SelectionCheckbox checked={isSelected} onClick={() => selectionMode?.toggle(item.Id)} />
      )}
      <div className="aspect-[2/3] bg-tentacle-surface">
        <img
          src={poster} alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
        />
      </div>

      {/* Hover action buttons */}
      <div className={`absolute right-1.5 top-1.5 z-10 flex flex-col gap-1 transition-opacity ${isSelecting ? "hidden" : "opacity-0 group-hover:opacity-100"}`}
        style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }} className="flex flex-col gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => {
              e.stopPropagation();
              setLocalFavorite(!localFavorite);
              if (localFavorite) removeFav.mutate(); else addFav.mutate();
            }}
          >
            {localFavorite ? (
              <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
            )}
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => {
              e.stopPropagation();
              setLocalWatchlist(!localWatchlist);
              if (localWatchlist) removeWatchlist.mutate(); else addWatchlist.mutate();
            }}
          >
            {localWatchlist ? (
              <svg className="h-3.5 w-3.5 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
            )}
          </button>
        </div>
      </div>

      <div className="p-2.5">
        <p className="text-sm font-medium text-white line-clamp-1">{item.Name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/50">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
        </div>
      </div>
      {progress != null && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-tentacle-accent" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!isSelecting && ctxMenu && (
        <MediaContextMenu
          itemId={item.Id}
          isFavorite={localFavorite}
          isInWatchlist={localWatchlist}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onToggleFavorite={() => setLocalFavorite(!localFavorite)}
          onToggleWatchlist={() => setLocalWatchlist(!localWatchlist)}
        />
      )}
    </div>
  );
}
