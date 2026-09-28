import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaItem } from "./useLibrary";

/**
 * Vrai quand la carte porte un item RÉDUIT : un résultat de recherche, un
 * titre « similaire », un contenu de collection — tout ce qui arrive sans
 * `ProviderIds`. Il ne sait alors ni ce que noter (le tmdb manque), ni dire
 * juste si un film est dans Ma liste une fois basculé : sa réponse n'est pas
 * patchée par les mutations, la fiche `["item", id]` l'est.
 *
 * Un épisode n'en a pas besoin : sa note passe par sa série
 * (`useCardRatingTarget`), Ma liste et favoris par les Sets de séries.
 */
export function cardFaceNeedsDetail(item: MediaItem): boolean {
  if (item.Type !== "Movie" && item.Type !== "Series") return false;
  return !item.ProviderIds;
}

/**
 * Le visage d'une carte pour son SURVOL — sa feuille, son menu : l'item de la
 * carte, ou sa fiche complète quand la carte n'en porte qu'un résumé.
 *
 * La fiche se charge à la demande (`enabled` le temps du survol) sur la clé
 * `["item", id]` de la page de détail : le survol la préchauffe, et les
 * bascules y écrivent leur mise à jour optimiste — le plateau suit donc le
 * geste tout de suite, même sur une carte de recherche.
 */
export function useCardFace(
  item: MediaItem | null,
  options: { enabled: boolean },
): { face: MediaItem | null; pending: boolean } {
  const needsDetail = !!item && cardFaceNeedsDetail(item);
  const { data, isFetching } = useMediaItem(needsDetail ? item?.Id : undefined, {
    enabled: options.enabled && needsDetail,
  });
  return {
    face: (needsDetail && data) || item,
    pending: needsDetail && !data && options.enabled && isFetching,
  };
}
