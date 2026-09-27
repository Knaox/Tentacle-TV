/**
 * Contrat de `/api/swipe` (onglet « Affiner »). Copie des types du backend
 * (`apps/backend/src/services/swipe/swipeTypes.ts`) : les noms de champs sont
 * ceux du JSON — ne pas les renommer d'un seul côté.
 */
export type SwipeVerdict = "like" | "superlike" | "dislike" | "skip";
export type SwipeDeckSource = "taste" | "popular" | "explore";

export interface SwipeCard {
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  genres: string[];
  voteAverage: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  jellyfinItemId: string | null;
  source: SwipeDeckSource;
  reason: string | null;
}

export type SwipeCounts = Record<SwipeVerdict, number>;

export interface SwipeDeckResponse {
  cards: SwipeCard[];
  tmdbConfigured: boolean;
  counts: SwipeCounts;
}

export interface SwipeCardDetails {
  title: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  seasons: number | null;
}

export type SwipeLang = "fr" | "en";

/** La langue de la pile d'après celle de l'interface. */
export function swipeLangOf(language: string | undefined): SwipeLang {
  return language?.startsWith("fr") ? "fr" : "en";
}
