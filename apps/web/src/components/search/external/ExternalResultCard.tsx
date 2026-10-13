/**
 * La carte d'un titre HORS bibliothèque : l'affiche (ou ses initiales), la
 * pastille de l'extension, le titre et sa petite ligne. Un clic mène à la page
 * de l'extension qui montre le titre (`item.href`).
 *
 * Au survol — et au focus : c'est une grille qu'on parcourt au clavier —, le
 * survol UNIQUE des cartes hors bibliothèque (`ExternalHoverOverlay`) : les
 * étoiles, puis le plateau — « Demander » en tête, « Ma liste à l'arrivée »,
 * « J'aime ». Au repos, la pastille suit l'état que l'extension donne du
 * titre (« Demandé » dès la demande faite), et les marqueurs communs disent
 * la note posée, la mise de côté et le cœur qui attend l'arrivée. Il faut
 * pour cela que l'extension donne l'identifiant TMDB du titre
 * (`item.tmdbId`) ; sans lui, la carte reste celle d'avant.
 *
 * Elle occupe toute la largeur que son parent lui donne : la grille des
 * résultats comme une rangée d'affiches décident de la taille, pas elle.
 */

import { memo, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsFavoritePending, useIsWatchlistPending } from "@tentacle-tv/api-client";
import { externalMarkerFace, titleMediaType, type ExternalSearchItem } from "@tentacle-tv/shared";
import { ExternalBadge, ExternalPoster } from "./ExternalVisuals";
import { CardMarkerLayer } from "../../cards/CardMarkerLayer";
import { ExternalHoverOverlay } from "../../cards/external/ExternalHoverOverlay";
import { externalTitleKey, useExternalTitleState, type ExternalTitle } from "../../cards/external/useTitleProvider";
import { CardPreview, useCardPreview } from "../../cards/preview";
import { useCardHover } from "../../cards/useCardHover";
import { useMountWhile } from "../../../hooks/useMountWhile";

/** L'identité TMDB d'un résultat, quand l'extension l'a donnée. */
function titleOf(item: ExternalSearchItem): ExternalTitle | null {
  return item.tmdbId ? { mediaType: titleMediaType(item.kind), tmdbId: item.tmdbId } : null;
}

export const ExternalResultCard = memo(function ExternalResultCard({ item }: { item: ExternalSearchItem }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  // Le survol des cartes focalisables : la souris, ou le focus CLAVIER
  // (`:focus-visible`) ; la grille qui défile sous un curseur immobile le
  // coupe (`useHoverGuard`, dans `useCardHover`).
  const hover = useCardHover(rootRef);
  const active = hover.hovered;
  const title = useMemo(() => titleOf(item), [item]);
  // La bande-annonce que TMDB connaît, au survol prolongé ; la mini-carte
  // reprend le survol (et le focus clavier y entre sans quitter la carte).
  const preview = useCardPreview({
    source: { title },
    hovered: active,
    shape: "poster",
    companionRef: hover.companionRef,
  });
  const overlayVisible = active && !preview.shown;
  const overlayMounted = useMountWhile(overlayVisible && title !== null, 200);
  const state = useExternalTitleState(title);
  const pending = useIsWatchlistPending(externalTitleKey(title));
  const liked = useIsFavoritePending(externalTitleKey(title));
  const face = useMemo(() => (title ? externalMarkerFace(title, item.title) : null), [item.title, title]);
  const badge = state?.badge ?? item.badge;

  const open = () => navigate(item.href);

  return (
    <div ref={rootRef} className="group/x relative" {...hover.handlers}>
      {/* div-bouton et non <button> : le voile porte étoiles et bascules, et un
          bouton dans un bouton est du HTML invalide. */}
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          open();
        }}
        aria-label={item.subtitle ? `${item.title} — ${item.subtitle}` : item.title}
        className="block w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {/* Le visuel : l'ancre de la mini-carte, qui s'efface sous elle. */}
        <div
          ref={preview.anchorRef}
          className="relative overflow-hidden rounded-md transition-opacity duration-200"
          style={{ opacity: preview.shown ? 0 : undefined }}
        >
          <ExternalPoster item={item} className="aspect-[2/3] w-full rounded-md" />
          {badge !== null && (
            <ExternalBadge
              badge={badge}
              onMedia
              className={`absolute left-2 top-2 z-10 transition-opacity duration-150 ${overlayVisible && title ? "opacity-0" : "opacity-100"}`}
            />
          )}
          {face && (
            <CardMarkerLayer
              item={face}
              communityRating={null}
              hideRating={overlayVisible}
              hideStatus={overlayVisible}
              inWatchlist={pending}
              isFavorite={liked}
            />
          )}
          {overlayMounted && title && (
            <ExternalHoverOverlay variant="poster" title={title} name={item.title} visible={overlayVisible} />
          )}
          {title && (
            <CardPreview controller={preview} title={item.title}>
              {(visible) => (
                <ExternalHoverOverlay variant="poster" surface="preview" title={title} name={item.title} visible={visible} />
              )}
            </CardPreview>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-medium text-content-primary group-hover/x:text-[var(--brand-light)]">{item.title}</p>
        {item.subtitle !== null && <p className="truncate text-xs text-content-quaternary">{item.subtitle}</p>}
      </div>
    </div>
  );
});
