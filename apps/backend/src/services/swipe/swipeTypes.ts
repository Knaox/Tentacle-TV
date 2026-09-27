/** Les quatre gestes de l'onglet « Affiner ». « skip » ne juge rien. */
export const SWIPE_VERDICTS = ["like", "superlike", "dislike", "skip"] as const;
export type SwipeVerdict = (typeof SWIPE_VERDICTS)[number];

/**
 * D'où vient une carte de la pile :
 * - `taste` : le haut du pool classé du compte (proche de ses goûts) ;
 * - `popular` : les tendances TMDB, ou les mieux notés de la bibliothèque ;
 * - `explore` : un tirage hors des sentiers — le reste du pool, des classiques
 *   TMDB, des titres de bibliothèque jamais proposés.
 */
export type DeckSource = "taste" | "popular" | "explore";

/** Une carte servie au client — jamais la moindre clé ni URL signée. */
export interface SwipeCard {
  /** Clé canonique « movie:603 » / « tv:1399 ». */
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  genres: string[];
  /** Note sur 10 (TMDB, ou communautaire Jellyfin en bibliothèque). */
  voteAverage: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  /** Présent quand le titre est dans la bibliothèque Jellyfin. */
  jellyfinItemId: string | null;
  source: DeckSource;
  /** Titre aimé qui porte la carte (« Parce que vous avez aimé… »). */
  reason: string | null;
}
