import type { FacetEntry } from "../facets";

/** Un candidat au classement, quelle que soit sa source. */
export interface Candidate {
  /** Clé canonique "movie:603" — la même que Vigie. */
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  facets: FacetEntry[];
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  source: "tmdb_rec" | "tmdb_discover" | "tmdb_anime" | "tmdb_person" | "vigie" | "library";
  /** Présent quand le titre est dans la bibliothèque Jellyfin. */
  jellyfinItemId?: string | null;
  posterPath?: string | null;
  /** Visuel large TMDB — le carrousel héros s'en sert côté client. */
  backdropPath?: string | null;
  /** Clé de la graine qui a produit ce candidat (rangées « Parce que… »). */
  seedKey?: string | null;
  /** Soutien CUMULÉ des graines : chaque graine qui le recommande ajoute sa
   *  force, pondérée par le rang du candidat dans sa liste TMDB. Un titre
   *  recommandé par six titres aimés n'est pas un titre recommandé par un seul. */
  seedSupport?: number;
  /** id TMDB de la personne aimée qui a produit ce candidat (« Avec X »). */
  personKey?: number | null;
}

/** Le vecteur de goût d'un compte, parsé depuis TasteProfile.facets. */
export interface TasteVector {
  facets: Record<string, number>;
  signalCount: number;
  /** Part d'animé dans les signaux de consommation (0..1) — absent = 0 (vieux profil). */
  animeShare?: number;
}

/**
 * Le détail du score, PAR COMPOSANTE et par facette : c'est l'explicabilité de
 * l'UI (« Parce que vous avez noté Dune 9/10 ») et l'outil de debug du moteur.
 */
export interface ScoreBreakdown {
  total: number;
  /** Similarité profil↔candidat, normalisée 0..1. */
  similarity: number;
  /** Note bayésienne normalisée 0..1. */
  quality: number;
  /** Bonus de récence 0..1. */
  freshness: number;
  /** Pénalité de popularité (soustraite du total). */
  popularityPenalty: number;
  /** Les facettes qui ont le plus porté (ou plombé) la similarité. */
  topContributors: Array<{ key: string; contribution: number }>;
  /** Posé par le quota d'exploration — l'UI l'affiche comme tel. */
  exploration?: boolean;
  /** Proximité aux titres aimés, un par un (0..1) — stratégie à ancres. */
  relevance?: number;
  /** Soutien des graines TMDB (0..1). */
  seedSupport?: number;
  /** Ressemblance aux titres refusés ou abandonnés (0..1, soustraite). */
  negative?: number;
  /** Les titres aimés qui portent le plus ce candidat — la raison affichée
   *  « Parce que vous avez aimé… ». */
  topAnchors?: Array<{ key: string; title: string; contribution: number }>;
}

/**
 * LE point d'extension du classement : rien, nulle part, n'appelle une
 * implémentation directement — une future stratégie vectorielle se branche
 * ici sans toucher au reste du moteur.
 */
export interface ScoringStrategy {
  readonly id: string;
  /** Étalonnage sur le panier à classer, avant tout `score` (facultatif). */
  calibrate?(profile: TasteVector, candidates: readonly Candidate[]): void;
  score(profile: TasteVector, candidate: Candidate): ScoreBreakdown;
}
