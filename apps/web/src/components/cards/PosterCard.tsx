import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { resolvePosterImage, type PosterImageMode } from "./resolveCardImage";
import { POSTER_WIDTH, type CardSize } from "./cardSizes";

interface PosterCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
  /** `series` force le poster de la série pour un épisode (utilisé par « Derniers ajouts »). */
  posterImageMode?: PosterImageMode;
}

/**
 * 2:3 portrait card — the default tile for movies, series and library rows.
 * Hover effect: subtle scale + violet brand ring + quick actions reveal.
 * No detached popover (which was the source of the row-overlap bug).
 */
export function PosterCard({ item, index, size = "md", posterImageMode = "auto" }: PosterCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const [hovered, setHovered] = useState(false);
  const ctx = useCardContextMenu();

  const isEpisode = item.Type === "Episode";
  // Tuile série groupée « Derniers ajouts » : N épisodes ajoutés d'un coup.
  const addedCount = item.RecentlyAddedCount ?? 0;
  // Épisode → on ouvre la fiche de l'épisode lui-même (« le media detail du media »).
  const detailId = item.Id;
  // Épisode → affiche réelle de l'épisode (sa Primary), repli poster série.
  const { id: imageId, type: imageType } = resolvePosterImage(item, posterImageMode);
  const imageUrl = client.getImageUrl(imageId, imageType, { height: 450, quality: 90 });

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const widths = POSTER_WIDTH[size];
  const epLabel = isEpisode
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })
    : null;

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
        className="relative aspect-[2/3] overflow-hidden rounded-md transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none"
        style={{
          // Lift à ressort (ease-spring) + ombres TOKENISÉES : `--elev-*` suit
          // le thème (ombres douces en clair — un noir 0.45 en dur salissait le
          // fond nacré ou disparaissait). Le ring brand reste la signature.
          transform: hovered ? "scale(1.045) translateY(-5px)" : "scale(1)",
          boxShadow: hovered
            ? "var(--elev-card-hover), 0 0 0 2px rgba(var(--brand-rgb), 0.7), 0 0 28px rgba(var(--brand-rgb), 0.25)"
            : "var(--elev-1)",
        }}
      >
        <CardImage src={imageUrl} alt={item.Name} />

        {/* Badge compteur d'épisodes récemment ajoutés (tuile série groupée).
            Texte posé sur un fond de MARQUE (dégradé brand), pas sur l'affiche
            elle-même : suit le token dédié, identique dans les deux thèmes. */}
        {addedCount > 1 && (
          <div className="absolute left-1.5 top-1.5 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-cta-brand-fg shadow-[0_2px_8px_rgba(var(--brand-rgb),0.45)]">
            +{addedCount}
          </div>
        )}

        {/* Méta ultra-discrète révélée au survol : sur un portrait étroit (2:3),
            un seul chip qualité dominant + la pastille langues, image propre au repos.
            Masquée sur les regroupements d'épisodes (tuiles +N) : la méta d'un seul
            épisode n'aurait pas de sens pour un lot. */}
        {addedCount <= 1 && <CardMetaOverlay item={item} density="compact" reveal="hover" />}

        {/* Scrim posé SUR l'affiche : blanc/noir constants dans les deux
            thèmes (cf. règle « posé sur média »). */}
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
          <CardQuickActions item={item} variant="compact" />
        </div>

        {/* Watched check (replaces quick actions when watched) — badge d'angle
            sur poster : reste blanc/noir dans les deux thèmes. */}
        {watched && !hovered && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </div>
        )}

        {!watched && <CardProgressBar percent={progress} />}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="truncate text-sm font-medium text-content-primary">
          {isEpisode ? (item.SeriesName ?? item.Name) : item.Name}
        </h3>
        {addedCount > 1 ? (
          <p className="mt-0.5 truncate text-xs text-content-quaternary">
            {t("common:addedEpisodes", { count: addedCount })}
          </p>
        ) : isEpisode ? (
          <p className="mt-0.5 truncate text-xs text-content-quaternary">
            {[epLabel, item.Name].filter(Boolean).join(" · ")}
          </p>
        ) : (
          item.ProductionYear && (
            <p className="mt-0.5 text-xs text-content-quaternary">{item.ProductionYear}</p>
          )
        )}
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
