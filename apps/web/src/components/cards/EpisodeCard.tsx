import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "./CardFrame";
import { CardImage } from "./CardImage";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { CardMoreInfoButton } from "./CardMoreInfoButton";
import { CardHoverPreview } from "./CardHoverPreview";
import { useHoverPreview } from "./useHoverPreview";
import { prefetchDetailRoute } from "./prefetchDetail";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { CardMetaOverlay } from "../media/CardMetaOverlay";
import { resolveBannerImage } from "./resolveCardImage";
import { EPISODE_WIDTH, type CardSize } from "./cardSizes";

interface EpisodeCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
  /**
   * Largeur imposée par la rangée, en pixels, pour qu'un nombre entier de
   * cartes la remplisse exactement (`useRowCardWidth`). Absente hors rangée :
   * on retombe alors sur le `clamp` responsive.
   */
  width?: number | null;
}

/**
 * Vignette 16:9 des rangées « Reprendre » et « Prochains épisodes ».
 * Même cadre de survol que l'affiche 2:3 (`CardFrame`) : liseré dégradé, halo
 * de curseur, lift — avec une amplitude réduite, la carte étant plus large.
 * Le clic lance la lecture ; la fiche détail passe par « Plus d'infos ».
 */
export function EpisodeCard({ item, index, size = "md", width }: EpisodeCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const ctx = useCardContextMenu();
  const preview = useHoverPreview(ctx.ctxMenu !== null);

  const isEpisode = item.Type === "Episode";
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
      ref={preview.anchorRef}
      // `cursor-pointer` UNIQUEMENT quand la carte est elle-même la cible du
      // clic. Dès que le panneau prend le relais, c'est LUI qui porte les
      // intentions — vignette pour lire, tiroir pour la fiche — et chacune de
      // ses zones affiche son propre curseur. Laisser la main sur la carte
      // dessous laissait croire à une troisième cible cliquable.
      // `snap-start` : point d'accroche de la rangée (cf. `MediaRow`). C'est ce
      // qui fait qu'un défilement s'arrête sur une carte entière plutôt qu'au
      // milieu de l'une d'elles.
      className={`group/card row-dim-card relative flex-shrink-0 snap-start ${preview.panelActive ? "" : "cursor-pointer"}`}
      style={{
        width: width != null ? `${width}px` : `clamp(${widths.base}px, 24vw, ${widths.lg}px)`,
        animation: "fadeSlideUp 0.45s ease both",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
      onMouseEnter={() => { setHovered(true); prefetchDetailRoute(); preview.handlers.onMouseEnter(); }}
      onMouseLeave={() => { setHovered(false); preview.handlers.onMouseLeave(); }}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      {/* Le liseré répond dès l'entrée du curseur, mais la carte ne se déplace
          jamais quand un panneau doit prendre le relais : c'est LUI qui porte
          le lift, dans la continuité. Et dès qu'il est ouvert, la carte
          s'efface : il occupe sa place au pixel près, deux calques n'ont plus
          rien à faire l'un sur l'autre. */}
      <CardFrame
        hovered={hovered}
        suppressLift={preview.panelActive}
        concealed={preview.open}
        aspect="aspect-video"
        lift={{ scale: 1.03, y: -5 }}
      >
        {/* Pas de zoom interne quand le panneau prend le relais : il peindrait
            la même image à un autre cadrage, d'où le recul brutal ressenti à
            l'ouverture. */}
        <CardImage src={imageUrl} alt={item.Name} zoom={!preview.panelActive} />

        {/* Qualité/langues au survol UNIQUEMENT là où il n'y a pas de panneau
            (toucher, petit écran) : sinon elles s'affichaient sur la vignette
            en même temps que le panneau les répétait juste à côté. */}
        {!preview.panelActive && <CardMetaOverlay item={item} reveal="hover" />}

        {/* Scrim + libellé d'épisode posés SUR la vignette : blanc/noir
            constants dans les deux thèmes (règle « posé sur média »). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: "var(--card-reveal-scrim)" }}
        />

        <div className="absolute inset-x-0 bottom-1.5 pl-3 pr-28 text-on-media-primary">
          {epLabel && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-media-secondary">
              {epLabel}
            </p>
          )}
          {episodeName && <p className="line-clamp-1 text-xs font-semibold">{episodeName}</p>}
        </div>

        {/* Repli sur l'ancien survol de carte partout où le panneau ne peut
            PAS s'ouvrir : appareil tactile, petit écran, mais aussi carte trop
            basse ou rognée par le bord de la rangée. Sans ce repli, ces cartes
            n'offraient plus aucune action au survol. */}
        {!preview.panelActive && (
          <>
            <div
              className="absolute right-2 top-2 z-20 transition-opacity duration-150"
              style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? "auto" : "none" }}
            >
              <CardQuickActions item={item} variant="bar" />
            </div>
            <CardMoreInfoButton detailId={item.Id} visible={hovered} />
          </>
        )}

        {!watched && <CardProgressBar percent={progress} border />}
      </CardFrame>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{seriesName}</h3>
        {runtime && <p className="mt-0.5 text-xs text-content-quaternary">{runtime}</p>}
      </div>

      <CardHoverPreview
        item={item}
        anchor={preview.anchor}
        bounds={preview.bounds}
        cardImageUrl={imageUrl}
        onClose={preview.close}
        panelHandlers={preview.panelHandlers}
      />

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
