import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useToggleWatchlist, useFavorite, useAppConfig } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { SharedWatchlistPicker } from "./SharedWatchlistPicker";
import { CardMetaOverlay } from "./media/CardMetaOverlay";

interface Props {
  item: MediaItem;
  onNavigate: (id: string) => void;
}

/** Card grid de la page Bibliothèque — extraite de LibraryGrid.tsx pour
 *  garder ce dernier sous 300 lignes. Comportement inchangé : poster 2:3,
 *  hover-actions (fav / watchlist / shared list), context menu long-press,
 *  CardMetaOverlay compact (1 chip dominant + 1 drapeau). */
export const LibraryGridCard = memo(function LibraryGridCard({ item, onNavigate }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localFavorite, setLocalFavorite] = useState(item.UserData?.IsFavorite === true);
  const [localWatchlist, setLocalWatchlist] = useState(item.UserData?.Likes === true);
  useEffect(() => { setLocalFavorite(item.UserData?.IsFavorite === true); }, [item.UserData?.IsFavorite]);
  useEffect(() => { setLocalWatchlist(item.UserData?.Likes === true); }, [item.UserData?.Likes]);

  const { add: addFav, remove: removeFav } = useFavorite(item.Id);
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(item.Id);
  const { data: config } = useAppConfig();
  const [sharedPickerPos, setSharedPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [addedToShared, setAddedToShared] = useState(false);

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
      onClick={() => { if (!ctxMenu) onNavigate(item.Id); }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-tentacle-surface transition-transform duration-300 hover:scale-[1.03]"
    >
      <div className="relative aspect-[2/3] bg-tentacle-surface">
        <img
          src={poster} alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s ease" }}
        />
        <CardMetaOverlay item={item} density="compact" />
      </div>

      <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100"
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
          {config?.features.sharedWatchlists && (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setSharedPickerPos(sharedPickerPos ? null : {
                  x: Math.min(rect.right + 8, window.innerWidth - 280),
                  y: rect.top,
                });
              }}
            >
              <svg className={`h-3.5 w-3.5 ${addedToShared ? "text-pink-400" : "text-white/60"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h6m3 0h3m-1.5-1.5v3" />
              </svg>
            </button>
          )}
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

      {ctxMenu && (
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

      {sharedPickerPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSharedPickerPos(null)} />
          <div
            className="fixed z-50 w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#12121a]/95 shadow-2xl backdrop-blur-lg"
            style={{ left: sharedPickerPos.x, top: sharedPickerPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <SharedWatchlistPicker itemId={item.Id} onDone={() => setSharedPickerPos(null)} onSuccess={() => setAddedToShared(true)} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
});
