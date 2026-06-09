import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { CardMoreInfoButton } from "./CardMoreInfoButton";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { resolveBannerImage } from "./resolveCardImage";
import { EPISODE_WIDTH, type CardSize } from "./cardSizes";

interface EpisodeCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
}

/**
 * 16:9 landscape card for Continue Watching / Next Episode rows.
 * Hover effect: subtle scale + violet brand ring + quick actions reveal.
 * No detached popover (which was the source of the row-overlap bug).
 */
export function EpisodeCard({ item, index, size = "md" }: EpisodeCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const ctx = useCardContextMenu();

  const isEpisode = item.Type === "Episode";

  // Pour un épisode : vraie image de l'épisode d'abord, repli backdrop série.
  const { id: imageId, type: imageType } = resolveBannerImage(item);
  const imageUrl = client.getImageUrl(imageId, imageType, { width: 720, quality: 80 });

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const widths = EPISODE_WIDTH[size];
  const runtime = formatDuration(item.RunTimeTicks);

  const epLabel = isEpisode
    ? `S${String(item.ParentIndexNumber ?? 0).padStart(2, "0")}E${String(item.IndexNumber ?? 0).padStart(2, "0")}`
    : null;
  const seriesName = isEpisode ? item.SeriesName : item.Name;
  const episodeName = isEpisode ? item.Name : null;

  const handleClick = () => {
    if (ctx.ctxMenu) return;
    navigate(`/watch/${item.Id}`);
  };

  return (
    <div
      className="group/card relative flex-shrink-0 cursor-pointer"
      style={{
        width: `clamp(${widths.base}px, 24vw, ${widths.lg}px)`,
        animation: "fadeSlideUp 0.45s ease both",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      <div
        className="relative aspect-video overflow-hidden rounded-md transition-all duration-200"
        style={{
          transform: hovered ? "scale(1.03) translateY(-2px)" : "scale(1)",
          boxShadow: hovered
            ? "0 12px 28px var(--surface-overlay), 0 0 0 2px rgba(var(--brand-rgb), 0.7), 0 0 28px rgba(var(--brand-rgb), 0.25)"
            : "0 2px 8px rgba(0,0,0,0.45)",
        }}
      >
        <CardImage src={imageUrl} alt={item.Name} />

        {/* Méta discrète (qualité + langues), révélée au survol — image propre au repos. */}
        <CardMetaOverlay item={item} reveal="hover" />

        {/* Bottom-fade so episode label stays readable on bright scenes */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-1.5 pl-3 pr-28 text-white">
          {epLabel && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{epLabel}</p>
          )}
          {episodeName && (
            <p className="line-clamp-1 text-xs font-semibold">{episodeName}</p>
          )}
        </div>

        {/* Quick actions — top-right on hover */}
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

        {/* Bouton discret « Plus d'infos » — clic carte = lecture, ce bouton = fiche détail */}
        <CardMoreInfoButton detailId={item.Id} visible={hovered} />

        {!watched && <CardProgressBar percent={progress} border />}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-medium text-white/90">{seriesName}</h3>
        {runtime && <p className="mt-0.5 text-xs text-white/45">{runtime}</p>}
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
