import { memo, useCallback, useRef, useState } from "react";
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
import { resolvePosterImage, type PosterImageMode } from "@tentacle-tv/shared";
import { POSTER_VW, POSTER_WIDTH, type CardSize } from "./cardSizes";
import { cardWidthStyle } from "./cardWidthStyle";
import { useHoverGuard } from "../../hooks/useHoverGuard";

interface PosterCardProps {
  item: MediaItem;
  index: number;
  size?: CardSize;
  /** `series` force le poster de la série pour un épisode (« Derniers ajouts »). */
  posterImageMode?: PosterImageMode;
  /**
   * Largeur imposée par la rangée, en pixels, pour qu'un nombre entier de
   * cartes la remplisse exactement (`useRowCardWidth`). Absente hors rangée :
   * on retombe alors sur le `clamp` responsive.
   */
  width?: number | null;
  /**
   * Décalage de la cascade d'entrée, en ms. `null` = pas d'animation du tout.
   *
   * La rangée ne l'accorde qu'à sa PREMIÈRE fenêtre. Depuis que les cartes hors
   * champ sont démontées, une carte qui revient à l'écran se remonte : garder le
   * décalage la ferait attendre jusqu'à 360 ms avant d'apparaître, et la rangée
   * clignoterait en cascade à chaque défilement.
   */
  entranceDelay?: number | null;
  /** Signale à la rangée quelle carte est survolée, pour l'épingler dans sa fenêtre. */
  onHoverIndex?: (index: number | null) => void;
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
 *
 * `memo` : la rangée est fenêtrée, donc elle se re-rend chaque fois que sa
 * fenêtre glisse — soit une fois par carte franchie. Sans cette barrière, les
 * dix cartes montées se reconstruiraient alors qu'une seule entre réellement.
 * Toutes les props sont stables (`index` est celui de la liste, invariant).
 */
export const PosterCard = memo(function PosterCard({
  item,
  index,
  size = "md",
  posterImageMode = "auto",
  width,
  entranceDelay = null,
  onHoverIndex,
}: PosterCardProps) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctx = useCardContextMenu();
  // Le survol se coupe aussi quand la carte glisse hors du curseur pendant un
  // défilement, sans quoi il resterait allumé jusqu'au prochain mouvement de
  // souris (cf. `useHoverGuard`).
  const unhover = useCallback(() => setHovered(false), []);
  useHoverGuard(rootRef, hovered, unhover);

  const isEpisode = item.Type === "Episode";
  const addedCount = item.RecentlyAddedCount ?? 0;
  const resolvedImage = resolvePosterImage(item, posterImageMode);
  // « » : la donnée prouve qu'il n'y a pas d'affiche — `CardImage` rend son
  // repli sans lancer une requête vouée au 404 (cf. `cardImage.ts` (shared)).
  const imageUrl = resolvedImage
    ? client.getImageUrl(resolvedImage.id, resolvedImage.type, {
        height: 450,
        quality: 90,
        ...(resolvedImage.tag ? { tag: resolvedImage.tag } : {}),
      })
    : "";

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
        width: cardWidthStyle(width, widths, POSTER_VW),
        animation: entranceDelay == null ? undefined : "fadeSlideUp 0.34s ease both",
        animationDelay: entranceDelay == null ? undefined : `${entranceDelay}ms`,
        // La carte survolée passe AU-DESSUS de ses voisines. Sans cela son ombre
        // d'élévation est recouverte du côté droit par la carte suivante — un
        // frère plus tardif, donc peint après elle : le relief se lisait à plat
        // de trois côtés sur quatre, et c'est ce qui a longtemps obligé à
        // compenser par un liseré de 1 px. `2` et pas plus : les flèches de
        // défilement de la rangée sont en `z-30` et doivent rester cliquables.
        // Aucun reflow — `z-index` n'entre pas dans la mise en page.
        zIndex: hovered ? 2 : undefined,
      }}
      onMouseEnter={() => { setHovered(true); onHoverIndex?.(index); prefetchDetailRoute(); }}
      onMouseLeave={() => { setHovered(false); onHoverIndex?.(null); }}
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
});
