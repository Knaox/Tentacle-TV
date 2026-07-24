import { useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { PosterTile } from "./cards/PosterTile";
import { useCardContextMenu } from "./cards/useCardContextMenu";
import { captureDetailOrigin } from "./detail/detailTransition";

interface Props {
  item: MediaItem;
  onNavigate: (id: string) => void;
}

/**
 * Carte de la grille Bibliothèque.
 *
 * Elle avait divergé des cartes de l'accueil : rayons, ombres et surtout
 * couleurs EN DUR (`rgba(0,0,0,0.55)`, `bg-white/10`, `text-red-400`) qui
 * cassaient en thème clair, plus deux boutons favori/liste dupliqués avec leur
 * propre état local — redondant avec le cache TanStack Query, donc capable de
 * désynchroniser d'avec la même carte affichée dans une rangée.
 *
 * Elle partage désormais `PosterTile` (visuel) et, à travers lui,
 * `CardQuickActions` (état issu du cache) avec `PosterCard` — dont elle a le
 * survol INTERNE, sans panneau flottant. Ne restent ici que les spécificités
 * de grille : largeur fluide et navigation déléguée au parent.
 */
export const LibraryGridCard = memo(function LibraryGridCard({ item, onNavigate }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();

  const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });

  return (
    <div
      ref={rootRef}
      onClick={() => {
        if (ctx.ctxMenu) return;
        captureDetailOrigin(rootRef.current, item.Id, poster);
        onNavigate(item.Id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group/card row-dim-card relative cursor-pointer"
      {...ctx.contextHandlers}
    >
      <PosterTile item={item} imageUrl={poster} hovered={hovered} />

      <div className="mt-2.5 px-0.5">
        <p className="line-clamp-1 text-sm font-semibold tracking-tight text-content-primary">{item.Name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-content-quaternary">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
        </div>
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
});
