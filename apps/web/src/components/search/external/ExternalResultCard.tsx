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

import { memo, useCallback, useMemo, useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useIsFavoritePending, useIsWatchlistPending } from "@tentacle-tv/api-client";
import { titleMediaType, type ExternalSearchItem, type MediaItem } from "@tentacle-tv/shared";
import { ExternalBadge, ExternalPoster } from "./ExternalVisuals";
import { CardMarkerLayer } from "../../cards/CardMarkerLayer";
import { ExternalHoverOverlay } from "../../cards/external/ExternalHoverOverlay";
import { externalTitleKey, useExternalTitleState, type ExternalTitle } from "../../cards/external/useTitleProvider";
import { useMountWhile } from "../../../hooks/useMountWhile";
import { useHoverGuard } from "../../../hooks/useHoverGuard";

/** L'identité TMDB d'un résultat, quand l'extension l'a donnée. */
function titleOf(item: ExternalSearchItem): ExternalTitle | null {
  return item.tmdbId ? { mediaType: titleMediaType(item.kind), tmdbId: item.tmdbId } : null;
}

/** Le visage `MediaItem` des marqueurs communs : un id qui ne désigne aucun item, le tmdb pour la note. */
function markerFace(item: ExternalSearchItem, title: ExternalTitle): MediaItem {
  return {
    Id: `ext:${title.mediaType}:${title.tmdbId}`,
    Name: item.title,
    Type: title.mediaType === "tv" ? "Series" : "Movie",
    ProviderIds: { Tmdb: String(title.tmdbId) },
  } as MediaItem;
}

export const ExternalResultCard = memo(function ExternalResultCard({ item }: { item: ExternalSearchItem }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const unhover = useCallback(() => setHovered(false), []);
  // La grille défile sous un curseur immobile : la carte quittée ne garde pas son survol.
  useHoverGuard(rootRef, hovered, unhover);
  const active = hovered || focused;
  const title = useMemo(() => titleOf(item), [item]);
  const overlayMounted = useMountWhile(active && title !== null, 200);
  const state = useExternalTitleState(title);
  const pending = useIsWatchlistPending(externalTitleKey(title));
  const liked = useIsFavoritePending(externalTitleKey(title));
  const face = useMemo(() => (title ? markerFace(item, title) : null), [item, title]);
  const badge = state?.badge ?? item.badge;

  const open = () => navigate(item.href);
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <div
      ref={rootRef}
      className="group/x relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={unhover}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
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
        <div className="relative overflow-hidden rounded-md">
          <ExternalPoster item={item} className="aspect-[2/3] w-full rounded-md" />
          {badge !== null && (
            <ExternalBadge
              badge={badge}
              onMedia
              className={`absolute left-2 top-2 z-10 transition-opacity duration-150 ${active && title ? "opacity-0" : "opacity-100"}`}
            />
          )}
          {face && (
            <CardMarkerLayer
              item={face}
              communityRating={null}
              hideRating={active}
              hideStatus={active}
              inWatchlist={pending}
              isFavorite={liked}
            />
          )}
          {overlayMounted && title && (
            <ExternalHoverOverlay variant="poster" title={title} name={item.title} visible={active} />
          )}
        </div>
        <p className="mt-2 truncate text-sm font-medium text-content-primary group-hover/x:text-[var(--brand-light)]">{item.title}</p>
        {item.subtitle !== null && <p className="truncate text-xs text-content-quaternary">{item.subtitle}</p>}
      </div>
    </div>
  );
});
