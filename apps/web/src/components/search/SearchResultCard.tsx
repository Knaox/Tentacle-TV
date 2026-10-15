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
import { Plus } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { MediaContextMenu } from "../MediaContextMenu";
import { PosterTile } from "../cards/PosterTile";
import { prefetchDetailRoute } from "../cards/prefetchDetail";
import { useCardContextMenu } from "../cards/useCardContextMenu";
import { useCardHover } from "../cards/useCardHover";
import { useCardPreview } from "../cards/preview";
import { captureDetailOrigin } from "../detail/detailTransition";
import { useSeriesGapOffer } from "../seasons/SeriesGapsScope";
import { SelectedRing, SelectionMark } from "../libraryDelete/SelectionMark";
import { useSearchSelection } from "./page/searchDeletion";

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
  // Mode sélection (supprimer des titres) : le clic coche, le survol et ses actions se taisent.
  const selection = useSearchSelection(item.Id);
  const selecting = selection !== undefined;
  const locked = selection?.mark === "locked" || selection?.mark === "pending";
  // La mini-carte prolonge la carte hors de son arbre DOM : le focus clavier y
  // entre sans quitter la carte (`companionRef`).
  const preview = useCardPreview({
    source: { item },
    hovered: hover.hovered,
    shape: "poster",
    companionRef: hover.companionRef,
    disabled: selecting || ctx.ctxMenu !== null,
  });
  // Une série incomplète (recherche seulement) le dit sous son affiche, au
  // repos : le plateau du survol n'est pas le seul chemin vers « Demander ».
  const gap = useSeriesGapOffer(item.Id);
  const image = resolvePosterImage(item, "auto");
  const imageUrl = image
    ? client.getImageUrl(image.id, image.type, { height: 450, quality: 90, ...(image.tag ? { tag: image.tag } : {}) })
    : "";
  const type =
    item.Type === "Movie" ? t("common:movie") :
    item.Type === "Series" ? t("common:series") :
    item.Type;

  const open = (range = false) => {
    if (selection) {
      if (!locked) selection.toggle(item.Id, range);
      return;
    }
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
      title={selection?.mark === "locked" ? t("libraryDelete:notDeletable") : undefined}
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
      {...(selecting ? {} : ctx.contextHandlers)}
    >
      {/* div-bouton et non <button> : le survol porte ses propres boutons, et un
          bouton dans un bouton est du HTML invalide. */}
      <div
        role={selecting ? "checkbox" : "button"}
        tabIndex={0}
        aria-label={selecting ? t("libraryDelete:checkTitle", { name: item.Name }) : item.Name}
        aria-checked={selecting ? selection.mark === "selected" : undefined}
        aria-disabled={selecting ? locked : undefined}
        onClick={(e) => open(e.shiftKey)}
        onMouseDown={(e) => { if (selecting && e.shiftKey) e.preventDefault(); }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          open(e.shiftKey);
        }}
        // L'anneau de focus est dessiné par l'affiche (`CardFrame`), qui se
        // soulève : sur ce bouton, il cernait aussi le titre et restait en place.
        // L'atténuation d'un titre refusé se pose ICI : l'entrée de la carte
        // (`fadeSlideUp … both`) impose son opacité à la racine.
        className={`group/focus block w-full text-left outline-none ${selecting && locked ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      >
        <PosterTile item={item} imageUrl={imageUrl} hovered={hover.hovered && !(selecting && locked)} showActions={!selecting} preview={preview} />
        <p className="mt-2.5 truncate px-0.5 text-sm font-semibold tracking-tight text-content-primary">{item.Name}</p>
        <p className="px-0.5 text-xs card-caption">
          {type}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
        </p>
        {gap && (
          <p className="mt-0.5 flex items-center gap-1 px-0.5 text-xs font-medium text-[var(--brand-light)]">
            <Plus className="h-3 w-3 shrink-0" strokeWidth={2.6} aria-hidden />
            <span className="truncate">{t("requests:missingSeasons", { count: gap.count })}</span>
          </p>
        )}
      </div>

      {selection && <SelectionMark mark={selection.mark} />}
      {selection?.mark === "selected" && <SelectedRing />}

      {!selecting && ctx.ctxMenu && (
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
