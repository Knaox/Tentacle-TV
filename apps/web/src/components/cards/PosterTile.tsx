import { useNavigate } from "react-router-dom";
import { useSeriesWatchState } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "./CardFrame";
import { CardImage } from "./CardImage";
import { CardMarkerLayer } from "./CardMarkerLayer";
import { CardProgressBar } from "./CardProgressBar";
import { CardHoverOverlay } from "./CardHoverOverlay";
import { useSeriesRatingMap } from "./SeriesRatingContext";
import { playTargetPath } from "./playTarget";
import { useMountWhile } from "../../hooks/useMountWhile";

interface PosterTileProps {
  item: MediaItem;
  imageUrl: string;
  /** Piloté par le parent, qui possède aussi le popover et le menu contextuel. */
  hovered: boolean;
  /** Compteur d'épisodes ajoutés d'un coup — tuile série groupée. */
  addedCount?: number;
  /**
   * Calque d'actions au survol. Le parent le coupe quand un autre mode prend
   * la main (sélection multiple d'une collection).
   */
  showActions?: boolean;
}

/**
 * Affiche 2:3 partagée par les rangées d'accueil, la grille de bibliothèque et
 * les collections — une seule définition, deux états :
 *
 *   • AU REPOS, l'affiche porte ses marqueurs (`CardMarkerLayer`) : la note en
 *     bas à gauche, la pastille d'états (Ma liste, favori, vu) en haut à
 *     droite, la progression au bord inférieur. Rien d'autre.
 *   • AU SURVOL, les marqueurs s'effacent et le survol unique des cartes
 *     (`CardHoverOverlay`, variante `poster`) prend l'affiche : puces
 *     qualité/langues en haut à gauche, voile, étoiles et plateau en bas —
 *     « Lire » discret en tête du plateau, rien au centre de l'image.
 *
 * Tout ce qui est POSÉ SUR l'affiche reste blanc/noir constant dans les deux
 * schémas : c'est la luminosité du poster qui commande le contraste.
 */
export function PosterTile({
  item,
  imageUrl,
  hovered,
  addedCount = 0,
  showActions = true,
}: PosterTileProps) {
  const navigate = useNavigate();

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const grouped = addedCount > 1;
  const actionsVisible = showActions && hovered;
  /**
   * Le calque est MONTÉ au survol, jamais laissé à `opacity: 0` : son plateau
   * s'abonne aux Sets `watchlist-series-ids` / `favorite-series-ids` et ses
   * étoiles à la liste des notes. Monté sur chaque affiche au repos, la
   * moindre invalidation re-rendait quatre-vingts cartes pour des boutons que
   * personne ne regarde. 200 ms = la durée de ses fondus de sortie.
   */
  const layerMounted = useMountWhile(actionsVisible, 200);

  // Épisode à lancer pour une SÉRIE — résolu au survol seulement : la requête
  // coûte un appel par série, et `staleTime: 60s` couvre les allers-retours.
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(hovered && isSeries ? item.Id : undefined);
  // La note à poser : cette affiche montre le visage d'une SÉRIE, donc sa note
  // — y compris sur une tuile de lot « +N ». Sans fournisseur de notes
  // au-dessus, `useSeriesRatingMap` rend une carte vide.
  const { rating } = cardRatingFor(item, "series", useSeriesRatingMap());
  const resume = isSeries
    ? watchState?.type === "continue"
    : progress != null && progress > 0 && !watched;

  // Le bouton du plateau arrête déjà le clic : il n'atteint pas la carte.
  const handlePlay = () => {
    if (isSeries) {
      // `continue` rend l'épisode entamé, `next` le premier non vu. Série
      // terminée (ou état pas encore chargé) : la fiche plutôt qu'un épisode
      // au hasard.
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      navigate(epId ? `/watch/${epId}` : `/media/${item.Id}`);
      return;
    }
    navigate(playTargetPath(item));
  };

  return (
    <CardFrame hovered={hovered} aspect="aspect-[2/3]">
      <CardImage src={imageUrl} alt={item.Name} />

      {/* Compteur d'épisodes récemment ajoutés : posé sur un aplat de MARQUE
          (dégradé brand) et non sur l'affiche — d'où le token dédié. */}
      {grouped && (
        <div className="absolute left-2 top-2 z-30 rounded-md bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-cta-brand-fg shadow-[0_2px_8px_rgba(var(--brand-rgb),0.45)]">
          +{addedCount}
        </div>
      )}

      {/* Marqueurs du repos. La note cède la place aux puces qualité/langues
          dès le survol (et au focus sur téléviseur) : une information à la
          fois sur l'affiche visée. Les états cèdent la leur au plateau, qui
          les reprend à l'identique. */}
      <CardMarkerLayer
        item={item}
        communityRating={rating}
        hideRating={hovered && (actionsVisible || !grouped)}
        hideStatus={actionsVisible}
      />

      {/* Puces qualité/langues AU-DESSUS du voile, sauf sur un lot
          d'épisodes : la qualité d'un seul épisode ne dit rien du groupe. */}
      {showActions && layerMounted && (
        <CardHoverOverlay
          variant="poster"
          item={item}
          title={item.Name}
          visible={actionsVisible}
          play={{ resume, onPlay: handlePlay }}
          meta={grouped ? null : item}
        />
      )}

      {/* La progression reste visible sous le plateau : c'est au survol qu'on
          décide de reprendre. */}
      {!watched && (
        <div className="absolute inset-x-0 bottom-0 z-30">
          <CardProgressBar percent={progress} />
        </div>
      )}
    </CardFrame>
  );
}
