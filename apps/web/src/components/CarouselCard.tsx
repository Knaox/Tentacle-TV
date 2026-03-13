import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useToggleWatchlist, useFavorite, useAppConfig, useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { SharedWatchlistPicker } from "./SharedWatchlistPicker";

export function CarouselCard({ item, index }: { item: MediaItem; index: number }) {
  const { t } = useTranslation("common");
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const progress = item.UserData?.PlayedPercentage;
  const watched = item.UserData?.Played === true;
  const isEpisode = item.Type === "Episode";
  const genre = item.Genres?.[0];

  // Local optimistic state — syncs from prop, toggles instantly on click
  const [localWatchlist, setLocalWatchlist] = useState(item.UserData?.Likes === true);
  const [localFavorite, setLocalFavorite] = useState(item.UserData?.IsFavorite === true);
  useEffect(() => { setLocalWatchlist(item.UserData?.Likes === true); }, [item.UserData?.Likes]);
  useEffect(() => { setLocalFavorite(item.UserData?.IsFavorite === true); }, [item.UserData?.IsFavorite]);

  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlist(item.Id);
  const { add: addFav, remove: removeFav } = useFavorite(item.Id);
  const { data: config } = useAppConfig();
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const [sharedPickerPos, setSharedPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [addedToShared, setAddedToShared] = useState(false);

  const imageUrl =
    isEpisode && item.SeriesId
      ? client.getImageUrl(item.SeriesId, "Primary", { height: 450, quality: 90 })
      : client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });

  const detailId = isEpisode ? (item.SeriesId ?? item.Id) : item.Id;

  const handleClick = () => {
    if (ctxMenu) return;
    navigate(`/media/${detailId}`);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      setCtxMenu(pos);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      className="group/card relative flex-shrink-0 cursor-pointer"
      style={{
        width: 165,
        animation: `fadeSlideUp 0.5s ease both`,
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Poster */}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          aspectRatio: "2/3",
          transition: "box-shadow 0.35s ease, border-color 0.35s ease",
          boxShadow: hovered
            ? "0 12px 40px rgba(139,92,246,0.5), 0 0 0 2px rgba(139,92,246,0.6), 0 0 60px rgba(139,92,246,0.2)"
            : "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <img
          src={imageUrl}
          alt={item.Name}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          style={{
            opacity: imgLoaded ? 1 : 0,
            transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease, filter 0.35s ease",
            transform: hovered ? "scale(1.1)" : "scale(1)",
            filter: hovered ? "brightness(1.15)" : "brightness(1)",
          }}
        />

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex flex-col justify-end"
          style={{
            background: hovered
              ? "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%)",
            transition: "all 0.35s ease",
          }}
        >
          <div
            className="p-3"
            style={{
              transform: hovered ? "translateY(0)" : "translateY(10px)",
              opacity: hovered ? 1 : 0,
              transition: "all 0.3s ease 0.05s",
            }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {year && <span className="text-xs text-white/60">{year}</span>}
              {rating && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400">
                  <StarIcon /> {rating}
                </span>
              )}
              {genre && (
                <span
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{ background: "rgba(139,92,246,0.3)", color: "#c4b5fd" }}
                >
                  {genre}
                </span>
              )}
            </div>
            {isEpisode && (
              <p className="text-xs text-white/40">
                S{item.ParentIndexNumber}E{item.IndexNumber}
              </p>
            )}
            {/* Play button */}
            <button
              className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(139,92,246,0.85)",
                backdropFilter: "blur(8px)",
                opacity: hovered ? 1 : 0,
                transition: "all 0.3s ease 0.1s",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isSeries) {
                  const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
                  navigate(epId ? `/watch/${epId}` : `/media/${item.Id}`);
                } else {
                  navigate(`/watch/${item.Id}`);
                }
              }}
            >
              <PlayIcon /> {t("common:play")}
            </button>
          </div>
        </div>

        {/* Quick action buttons — top-right, hover only */}
        <div
          className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1"
          style={{
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? "auto" : "none",
            transition: "opacity 0.25s ease",
          }}
        >
          {/* Favorite toggle */}
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={(e) => {
              e.stopPropagation();
              setLocalFavorite(!localFavorite);
              if (localFavorite) removeFav.mutate();
              else addFav.mutate();
            }}
            aria-label={localFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {localFavorite ? (
              <svg className="h-3 w-3 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
            ) : (
              <svg className="h-3 w-3 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
            )}
          </button>
          {/* Watchlist toggle */}
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={(e) => {
              e.stopPropagation();
              setLocalWatchlist(!localWatchlist);
              if (localWatchlist) removeWatchlist.mutate();
              else addWatchlist.mutate();
            }}
            aria-label={localWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          >
            {localWatchlist ? (
              <svg className="h-3 w-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
            ) : (
              <svg className="h-3 w-3 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
            )}
          </button>
          {/* Shared watchlist button */}
          {config?.features.sharedWatchlists && (
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setSharedPickerPos(sharedPickerPos ? null : {
                  x: Math.min(rect.right + 8, window.innerWidth - 280),
                  y: rect.top,
                });
              }}
              aria-label="Add to shared list"
            >
              <svg className={`h-3 w-3 ${addedToShared ? "text-pink-400" : "text-white/60"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h6m3 0h3m-1.5-1.5v3" />
              </svg>
            </button>
          )}
        </div>

        {/* Watched badge */}
        {watched && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tentacle-accent shadow">
            <CheckIcon />
          </div>
        )}

        {/* Progress bar */}
        {!watched && progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div
              className="h-full rounded-r-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                boxShadow: hovered ? "0 0 12px rgba(139,92,246,0.6)" : "0 0 8px rgba(139,92,246,0.4)",
                transition: "box-shadow 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* Title below card */}
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-medium text-white/90">
          {isEpisode ? item.SeriesName : item.Name}
        </h3>
        <p className="mt-0.5 text-xs text-white/50">
          {year && <>{year}</>}
          {year && genre && " · "}
          {genre}
        </p>
      </div>

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
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
