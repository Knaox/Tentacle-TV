import type { SignalItem } from "./signals";

/**
 * Les ANCRES du goût : un compte n'est plus une moyenne unique de facettes
 * (où l'animé, le drame et les super-héros se diluaient les uns dans les
 * autres) mais la liste des titres qui comptent pour lui, chacun avec son
 * poids signé. Le classement compare un candidat à CHACUNE — un titre très
 * proche de deux ou trois ancres fortes passe devant, quel que soit le reste.
 */
export type AnchorKind =
  | "rating"
  | "favorite"
  | "like"
  /** HÉRITÉ des profils d'avant la v5 : Ma liste n'est plus un goût, un titre
   *  seulement listé est un POTENTIEL (cf. potentials.ts). Plus jamais écrit. */
  | "watchlist"
  | "completed"
  | "rewatch"
  | "series"
  | "abandon"
  | "dismissed"
  | "swipe_like"
  | "superlike"
  | "swipe_dislike";

export interface Anchor {
  /** Clé canonique « movie:603 » ; « jf:<itemId> » sans identité TMDB. */
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  /** Poids signé, décroissance comprise, borné (ANCHOR_MIN..ANCHOR_MAX). */
  weight: number;
  /** Vu, suivi ou noté — pas seulement listé ou refusé. */
  consumption: boolean;
  /** Heures regardées (film vu : sa durée ; série : ses épisodes vus). */
  hours: number;
  /** Dernier signal DATÉ (un marquage en masse ne date rien). */
  lastAt: string | null;
  kinds: AnchorKind[];
}

export interface PlayedEpisode {
  SeriesId?: string;
  RunTimeTicks?: number;
  UserData?: { LastPlayedDate?: string | null; PlayCount?: number };
}

/** Visionnage MESURÉ d'un item Jellyfin (watch_segments). */
export interface MeasuredViewing {
  /** Jours distincts où l'item a été regardé à au moins 60 %. */
  fullDays: number;
}

export interface AnchorInputs {
  now: number;
  ratings: ReadonlyArray<{ mediaType: string; tmdbId: number; score: number; updatedAt: Date | string }>;
  likes: ReadonlyArray<{ mediaType: string; tmdbId: number; createdAt: Date | string }>;
  feedback: ReadonlyArray<{ itemKey: string; action: string; createdAt: Date | string }>;
  /** Verdicts de l'onglet « Affiner » (absent = aucun). */
  swipes?: ReadonlyArray<{ mediaType: string; tmdbId: number; verdict: string; updatedAt: Date | string }>;
  favorites: readonly SignalItem[];
  playedMovies: readonly SignalItem[];
  resumable: readonly SignalItem[];
  playedEpisodes: readonly PlayedEpisode[];
  seriesById: ReadonlyMap<string, SignalItem>;
  measured?: ReadonlyMap<string, MeasuredViewing>;
}

export interface AnchorSet {
  anchors: Anchor[];
  /** Fiche Jellyfin de chaque ancre de bibliothèque — repli des facettes. */
  itemByKey: Map<string, SignalItem>;
  /** Tout titre qui porte au moins un signal de goût — vu, suivi, noté,
   *  aimé, refusé, abandonné — même trop faible pour faire une ancre (une
   *  note neutre) : JUGÉ, donc plus un potentiel. */
  judged: Set<string>;
}
