import { ratingKey, useMyRatings, type RatingIdentity } from "@tentacle-tv/api-client";

/**
 * La note du compte pour UN titre : 1..10, `null` s'il n'est pas noté,
 * `undefined` tant que la liste des notes n'est pas là.
 *
 * Pas `useItemRating` : il distingue le chargement par `isPending`, un champ
 * de TanStack Query v5 — le téléviseur tourne en v4, où il vaut `undefined`.
 * On lit donc la donnée elle-même, sous les deux versions. Un retrait en
 * cours de synchronisation n'est plus une note : même règle que les
 * marqueurs de carte (`useCardMarkers`), pour que les étoiles de la feuille
 * et la pastille de la carte ne se contredisent jamais.
 */
export function useTVUserScore(identity: RatingIdentity | null): number | null | undefined {
  const { data } = useMyRatings({ enabled: identity !== null });
  if (!identity) return null;
  if (!data) return undefined;
  const key = ratingKey(identity);
  const entry = data.find((rating) => rating.syncStatus !== "delete_pending" && ratingKey(rating) === key);
  return entry ? entry.score : null;
}
