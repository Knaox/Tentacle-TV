import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { PosterTile } from "./PosterTile";
import { useCardContextMenu } from "./useCardContextMenu";
import { MediaContextMenu } from "../MediaContextMenu";
import { captureDetailOrigin } from "../detail/detailTransition";
import { prefetchDetailRoute } from "./prefetchDetail";
import { resolvePosterImage, type PosterImageMode } from "./resolveCardImage";
import { POSTER_WIDTH, type CardSize } from "./cardSizes";

interface PosterCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
  /** `series` force le poster de la série pour un épisode (« Derniers ajouts »). */
  posterImageMode?: PosterImageMode;
}

/**
 * Carte 2:3 des rangées d'accueil et de bibliothèque.
 *
 * Ce composant ne s'occupe QUE du contexte de rangée — largeur, entrée en
 * cascade, bloc titre, menu contextuel. Toute l'apparence de l'affiche vit
 * dans `PosterTile`, partagé avec la grille de bibliothèque.
 *
 * PAS de panneau d'aperçu flottant ici, contrairement aux cartes 16:9. Sur une
 * colonne étroite, un panneau portalisé finit toujours désaligné de sa carte :
 * les contraintes de bord d'écran et de flèches de rangée le poussent
 * latéralement, alors que la carte, elle, ne bouge pas. Le survol des affiches
 * reste donc INTERNE (`PosterTile`), là où le désalignement est impossible.
 */
export function PosterCard({ item, index, size = "md", posterImageMode = "auto" }: PosterCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();

  const isEpisode = item.Type === "Episode";
  const addedCount = item.RecentlyAddedCount ?? 0;
  const { id: imageId, type: imageType } = resolvePosterImage(item, posterImageMode);
  const imageUrl = client.getImageUrl(imageId, imageType, { height: 450, quality: 90 });

  const widths = POSTER_WIDTH[size];
  const epLabel = isEpisode
    ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })
    : null;

  const handleClick = () => {
    if (ctx.ctxMenu) return;
    // Le rectangle de l'AFFICHE n'existe plus une fois la route changée : on le
    // capture ici, la fiche s'en sert pour s'ouvrir depuis cette place. La
    // racine embarquerait le bloc titre — un rectangle plus haut que l'image,
    // donc un visuel recadré pendant tout le trajet.
    captureDetailOrigin(
      rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null,
      item.Id,
      imageUrl,
    );
    navigate(`/media/${item.Id}`);
  };

  return (
    <div
      ref={rootRef}
      // `snap-start` : point d'accroche de la rangée (cf. `MediaRow`).
      className="group/card row-dim-card relative flex-shrink-0 cursor-pointer snap-start"
      style={{
        width: `clamp(${widths.base}px, 14vw, ${widths.lg}px)`,
        animation: "fadeSlideUp 0.45s ease both",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
      onMouseEnter={() => { setHovered(true); prefetchDetailRoute(); }}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      {...ctx.contextHandlers}
    >
      <PosterTile item={item} imageUrl={imageUrl} hovered={hovered} addedCount={addedCount} />

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">
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
