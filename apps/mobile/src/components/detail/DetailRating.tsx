import { episodeRatingIdentityFor, ratingIdentityForItem, tmdbIdForItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { RatingPanelMobile } from "../rating/RatingPanelMobile";

interface Props {
  item: MediaItem;
  /** La série d'un épisode : c'est SON tmdb qui identifie l'épisode noté. */
  parentSeries?: MediaItem;
}

/**
 * La note de l'utilisateur sur la fiche : film, série, ou épisode (tmdb de
 * la série + saison + numéro — la même identité que le web et le lecteur).
 * Rien n'est rendu pour un titre sans identifiant TMDB : il ne peut pas être
 * noté, et un bloc désactivé n'apprendrait rien à personne.
 */
export function DetailRating({ item, parentSeries }: Props) {
  const identity =
    item.Type === "Episode"
      ? episodeRatingIdentityFor(item, tmdbIdForItem(parentSeries))
      : ratingIdentityForItem(item);
  return <RatingPanelMobile identity={identity} jellyfinItemId={item.Id} />;
}
