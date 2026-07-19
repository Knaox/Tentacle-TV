import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
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
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })
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
        className="relative aspect-video overflow-hidden rounded-md transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none"
        style={{
          // Mêmes ombres tokenisées que PosterCard : `--elev-*` suit le thème
          // (les noirs en dur disparaissaient ou salissaient le fond clair).
          transform: hovered ? "scale(1.03) translateY(-4px)" : "scale(1)",
          boxShadow: hovered
            ? "var(--elev-card-hover), 0 0 0 2px rgba(var(--brand-rgb), 0.7), 0 0 28px rgba(var(--brand-rgb), 0.25)"
            : "var(--elev-1)",
        }}
      >
        <CardImage src={imageUrl} alt={item.Name} />

        {/* Méta discrète (qualité + langues), révélée au survol — image propre au repos. */}
        <CardMetaOverlay item={item} reveal="hover" />

        {/* Scrim + libellé épisode posés SUR la vignette : blanc/noir constants
            dans les deux thèmes (cf. règle « posé sur média »). */}
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
          <CardQuickActions item={item} variant="compact" />
        </div>

        {/* Bouton discret « Plus d'infos » — clic carte = lecture, ce bouton = fiche détail */}
        <CardMoreInfoButton detailId={item.Id} visible={hovered} />

        {!watched && <CardProgressBar percent={progress} border />}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-medium text-content-primary">{seriesName}</h3>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>

      {ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
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
