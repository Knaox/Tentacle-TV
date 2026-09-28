import { useCallback, useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "./MediaContextMenu";
import { PosterTile } from "./cards/PosterTile";
import { useCardContextMenu } from "./cards/useCardContextMenu";
import { prefetchDetailRoute } from "./cards/prefetchDetail";
import { captureDetailOrigin } from "./detail/detailTransition";
import { useHoverGuard } from "../hooks/useHoverGuard";

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
 * Elle partage désormais `PosterTile` (visuel) et, à travers lui, le survol
 * unique des cartes (`CardHoverOverlay`) avec `PosterCard`. Ne restent ici
 * que les spécificités de grille : largeur fluide et navigation déléguée au
 * parent.
 */
export const LibraryGridCard = memo(function LibraryGridCard({ item, onNavigate }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();
  // La grille est la surface où l'on défile le plus vite : sans ce garde, la
  // carte quittée gardait son survol jusqu'au prochain mouvement de souris
  // (cf. `useHoverGuard`).
  const unhover = useCallback(() => setHovered(false), []);
  useHoverGuard(rootRef, hovered, unhover);

  // Même résolution que les rangées : tag porté (URL adressée par contenu),
  // et « » quand la donnée prouve qu'il n'y a pas d'affiche (cf. `cardImage.ts`).
  const image = resolvePosterImage(item, "auto");
  const poster = image
    ? client.getImageUrl(image.id, image.type, { height: 450, quality: 90, ...(image.tag ? { tag: image.tag } : {}) })
    : "";

  return (
    <div
      ref={rootRef}
      onClick={() => {
        if (ctx.ctxMenu) return;
        // L'AFFICHE seule, pas la racine : celle-ci embarque le bloc titre, et
        // le visuel partait donc recadré (cf. `captureDetailOrigin`).
        captureDetailOrigin(
          rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null,
          item.Id,
          poster,
        );
        onNavigate(item.Id);
      }}
      onMouseEnter={() => {
        setHovered(true);
        prefetchDetailRoute();
      }}
      onMouseLeave={() => setHovered(false)}
      className="group/card row-dim-card relative cursor-pointer"
      // Au-dessus des voisines pendant le survol, sinon l'ombre d'élévation est
      // recouverte par la cellule suivante (cf. `PosterCard`).
      style={{ zIndex: hovered ? 2 : undefined }}
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
        />
      )}
    </div>
  );
});
