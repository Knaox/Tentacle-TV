/**
 * Une carte de la grille de résultats — la page `/search`, les parcours de
 * genre et de studio, la filmographie d'une personne (`/person/:id`).
 *
 * C'est l'affiche de toutes les autres grilles (`PosterTile`) : mêmes
 * marqueurs au repos, même survol (Lecture, étoiles, Ma liste, favori, vu,
 * hors ligne), même menu contextuel. Elle vivait à part — une `<img>` nue,
 * un dégradé permanent et, pour tout survol, le seul bouton hors ligne —, et
 * c'est là que la recherche ne ressemblait plus au reste de l'app.
 *
 * Elle lit un `MediaItem` : les résultats du moteur (`SearchMediaItem`) en ont
 * la forme. Ils arrivent sans `ProviderIds` : le survol charge la fiche pour
 * les étoiles (`useCardFace`).
 */

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "../MediaContextMenu";
import { PosterTile } from "../cards/PosterTile";
import { prefetchDetailRoute } from "../cards/prefetchDetail";
import { useCardContextMenu } from "../cards/useCardContextMenu";
import { useCardHover } from "../cards/useCardHover";
import { captureDetailOrigin } from "../detail/detailTransition";

export function SearchResultCard({
  item,
  index,
  onSelect,
}: {
  item: MediaItem;
  index: number;
  onSelect: (it: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const rootRef = useRef<HTMLLIElement>(null);
  // Ici la carte est atteignable au clavier : le survol suit aussi le focus
  // (cf. `useCardHover`) — c'est ce qui rend le plateau accessible sans souris.
  const hover = useCardHover(rootRef);
  const ctx = useCardContextMenu();
  const image = resolvePosterImage(item, "auto");
  const imageUrl = image
    ? client.getImageUrl(image.id, image.type, { height: 450, quality: 90, ...(image.tag ? { tag: image.tag } : {}) })
    : "";
  const type =
    item.Type === "Movie" ? t("common:movie") :
    item.Type === "Series" ? t("common:series") :
    item.Type;

  const open = () => {
    if (ctx.ctxMenu) return;
    // L'AFFICHE seule : la racine embarque les deux lignes de texte, et le
    // visuel partirait recadré pendant toute la transition d'ouverture.
    captureDetailOrigin(rootRef.current?.querySelector<HTMLElement>("[data-card-visual]") ?? null, item.Id, imageUrl);
    onSelect(item);
  };

  return (
    <li
      ref={rootRef}
      className="group/card relative"
      style={{
        animation: "fadeSlideUp 0.4s ease both",
        animationDelay: `${Math.min(index * 30, 300)}ms`,
        // La carte survolée passe au-dessus de ses voisines, son ombre aussi
        // (cf. `CardFrame`).
        zIndex: hover.hovered ? 2 : undefined,
      }}
      {...hover.handlers}
      onMouseEnter={() => {
        hover.handlers.onMouseEnter();
        prefetchDetailRoute();
      }}
      {...ctx.contextHandlers}
    >
      {/* div-bouton et non <button> : le survol porte ses propres boutons, et un
          bouton dans un bouton est du HTML invalide. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={item.Name}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          open();
        }}
        className="block w-full cursor-pointer rounded-[var(--radius-lg)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]"
      >
        <PosterTile item={item} imageUrl={imageUrl} hovered={hover.hovered} />
        <p className="mt-2.5 truncate px-0.5 text-sm font-semibold tracking-tight text-content-primary">{item.Name}</p>
        <p className="px-0.5 text-xs text-content-quaternary">
          {type}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
        </p>
      </div>

      {ctx.ctxMenu && (
        <MediaContextMenu
          item={item}
          x={ctx.ctxMenu.x}
          y={ctx.ctxMenu.y}
          onClose={ctx.closeCtxMenu}
        />
      )}
    </li>
  );
}
