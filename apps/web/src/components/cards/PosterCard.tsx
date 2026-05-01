import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { POSTER_WIDTH, type CardSize } from "./cardSizes";

interface PosterCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
}

/**
 * 2:3 portrait card — the default tile for movies, series and library rows.
 * Hover effect: subtle scale + violet brand ring + quick actions reveal.
 * No detached popover (which was the source of the row-overlap bug).
 */
export function PosterCard({ item, index, size = "md" }: PosterCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const ctx = useCardContextMenu();

  const isEpisode = item.Type === "Episode";
  const detailId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 450, quality: 90 });

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const widths = POSTER_WIDTH[size];

  const handleClick = () => {
    if (ctx.ctxMenu) return;
    navigate(`/media/${detailId}`);
  };

  return (
    <div
      className="group/card relative flex-shrink-0 cursor-pointer"
      style={{
        width: `clamp(${widths.base}px, 14vw, ${widths.lg}px)`,
        animation: "fadeSlideUp 0.45s ease both",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-md transition-all duration-200"
        style={{
          transform: hovered ? "scale(1.04) translateY(-2px)" : "scale(1)",
          boxShadow: hovered
            ? "0 12px 28px rgba(0,0,0,0.7), 0 0 0 2px rgba(139,92,246,0.7), 0 0 28px rgba(139,92,246,0.25)"
            : "0 2px 8px rgba(0,0,0,0.45)",
        }}
      >
        <CardImage src={imageUrl} alt={item.Name} />

        {/* Bottom dark fade so quick-actions stay readable on bright posters */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent transition-opacity duration-200"
          style={{ opacity: hovered ? 1 : 0 }}
          aria-hidden
        />

        {/* Quick actions — visible only on hover, top-right */}
        <div
          className="absolute right-1.5 top-1.5 transition-opacity duration-150"
          style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? "auto" : "none" }}
        >
          <CardQuickActions
            itemId={item.Id}
            initialFavorite={item.UserData?.IsFavorite === true}
            initialWatchlist={item.UserData?.Likes === true}
            initialWatched={item.UserData?.Played === true}
            variant="compact"
          />
        </div>

        {/* Watched check (replaces quick actions when watched) */}
        {watched && !hovered && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </div>
        )}

        {!watched && <CardProgressBar percent={progress} />}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-medium text-white/90">
          {isEpisode ? (item.SeriesName ?? item.Name) : item.Name}
        </h3>
        {item.ProductionYear && (
          <p className="mt-0.5 text-xs text-white/45">{item.ProductionYear}</p>
        )}
      </div>

      {ctx.ctxMenu && (
        <MediaContextMenu
          itemId={item.Id}
          isFavorite={item.UserData?.IsFavorite === true}
          isInWatchlist={item.UserData?.Likes === true}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
          onToggleFavorite={() => {}}
          onToggleWatchlist={() => {}}
        />
      )}
    </div>
  );
}
