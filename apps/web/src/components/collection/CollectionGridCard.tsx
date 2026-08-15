import { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "../MediaContextMenu";
import { SelectionCheckbox } from "../SelectionCheckbox";
import { PosterTile } from "../cards/PosterTile";
import { useCardContextMenu } from "../cards/useCardContextMenu";
import { captureDetailOrigin } from "../detail/detailTransition";
import { useHoverGuard } from "../../hooks/useHoverGuard";
import type { SelectionMode } from "./selectionMode";

interface CollectionGridCardProps {
  item: MediaItem;
  onNavigate: (id: string) => void;
  selectionMode?: SelectionMode;
}

/**
 * Carte des grilles Ma liste et Favoris.
 *
 * Elle redéfinissait auparavant sa propre affiche 2:3 — sans `CardFrame`, avec
 * un `transition-[transform,box-shadow]` (donc une ombre animée, ce que le reste
 * du catalogue a précisément cessé de faire) et deux badges favori/liste à état
 * LOCAL, redondants avec le cache et capables de se désynchroniser d'avec la
 * même carte affichée dans une rangée. C'est mot pour mot la dette déjà
 * remboursée par `LibraryGridCard`.
 *
 * Elle partage désormais `PosterTile` avec les rangées d'accueil et la grille de
 * bibliothèque : une seule définition de l'affiche, donc une seule élévation, un
 * seul survol, un seul jeu d'actions rapides (piloté par le cache). Ne restent
 * ici que les spécificités de collection : la sélection multiple et la
 * navigation déléguée au parent.
 */
export const CollectionGridCard = memo(function CollectionGridCard({
  item,
  onNavigate,
  selectionMode,
}: CollectionGridCardProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();
  // Une grille se défile vite : sans ce garde, la carte quittée gardait son
  // survol jusqu'au prochain mouvement de souris (cf. `useHoverGuard`).
  const unhover = useCallback(() => setHovered(false), []);
  useHoverGuard(rootRef, hovered, unhover);

  const isSelecting = selectionMode?.isSelecting ?? false;
  const isSelected = selectionMode?.isSelected(item.Id) ?? false;
  const poster = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });

  const handleClick = () => {
    if (isSelecting) {
      selectionMode?.toggle(item.Id);
      return;
    }
    if (ctx.ctxMenu) return;
    // L'AFFICHE seule, pas la racine : celle-ci embarque le bloc titre, et le
    // visuel partirait recadré pendant toute la transition d'ouverture.
    captureDetailOrigin(
      rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null,
      item.Id,
      poster,
    );
    onNavigate(item.Id);
  };

  return (
    <div
      ref={rootRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group/card row-dim-card relative cursor-pointer"
      style={{
        // Au-dessus des voisines pendant le survol, sinon l'ombre d'élévation est
        // recouverte par la cellule suivante (cf. `PosterCard`).
        zIndex: hovered ? 2 : undefined,
      }}
      {...(isSelecting ? {} : ctx.contextHandlers)}
    >
      {isSelecting && (
        <SelectionCheckbox checked={isSelected} onClick={() => selectionMode?.toggle(item.Id)} />
      )}

      {/* Actions rapides coupées en mode sélection : le clic y appartient à la
          sélection, et deux cibles concurrentes sur la même carte se disputent
          le geste. */}
      <PosterTile
        item={item}
        imageUrl={poster}
        hovered={hovered}
        showActions={!isSelecting}
      />

      <div className="mt-2.5 px-0.5">
        <p className="line-clamp-1 text-sm font-semibold tracking-tight text-content-primary">
          {item.Name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-content-quaternary">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          <span>{item.Type === "Movie" ? t("common:movie") : t("common:series")}</span>
        </div>
      </div>

      {/* Anneau de sélection posé en calque, pas en `ring` sur la racine : la
          racine n'a plus de rayon depuis que l'affiche est portée par
          `PosterTile`, et l'anneau doit épouser l'affiche, pas le bloc titre. */}
      {isSelected && (
        <div
          aria-hidden
          /* Le ratio en CLASSE : `aspect-ratio` en style en ligne échappe à la
             passe qui le traduit pour les moteurs d'avant Chrome 88, et l'anneau
             de sélection y aurait une hauteur nulle. */
          className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3] rounded-[var(--radius-lg)] ring-2 ring-[var(--brand)]"
        />
      )}

      {!isSelecting && ctx.ctxMenu && (
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
