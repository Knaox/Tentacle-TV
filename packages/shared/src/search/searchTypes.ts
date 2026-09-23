/**
 * Le contrat de `/api/search` — le moteur de recherche du serveur Tentacle.
 *
 * Recopié octet pour octet dans le backend (`apps/backend/src/search/`), tenu
 * par `searchMirror.test.ts` — on modifie ICI, on recopie là-bas. D'où un
 * fichier SANS import : le backend ne dépend pas de ce paquet.
 *
 * Les titres trouvés sont des `MediaItem` RÉDUITS (`SearchMediaItem` :
 * identifiant, nom, type, année, note, tags d'image, données de visionnage),
 * structurellement compatibles avec `MediaItem` : les cartes de l'app les
 * lisent tels quels, sans second aller-retour vers Jellyfin.
 */

export type SearchItemKind = "Movie" | "Series" | "BoxSet";

/** Les données de visionnage — les champs obligatoires de `UserItemData`. */
export interface SearchUserData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  Played: boolean;
  PlayedPercentage?: number;
  UnplayedItemCount?: number;
  LastPlayedDate?: string;
}

/** Un `MediaItem` réduit à ce qu'une carte de résultat affiche. */
export interface SearchMediaItem {
  Id: string;
  Name: string;
  Type: SearchItemKind | "Episode";
  OriginalTitle?: string;
  ProductionYear?: number;
  EndDate?: string;
  CommunityRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  Status?: string;
  ChildCount?: number;
  PrimaryImageAspectRatio?: number;
  Genres?: string[];
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  /** Épisodes : la série, son affiche, la position dans la saison. */
  SeriesName?: string;
  SeriesId?: string;
  SeriesPrimaryImageTag?: string;
  ParentBackdropImageTags?: string[];
  IndexNumber?: number;
  ParentIndexNumber?: number;
  UserData?: SearchUserData;
}

/** Le champ qui a fait trouver un titre — dit à l'écran (« avec Tom Hanks »). */
export type SearchMatchField = "title" | "originalTitle" | "people" | "genre" | "studio";

export interface SearchMatch {
  field: SearchMatchField;
  /** La personne, le genre ou le studio en cause, tel qu'affiché. */
  value?: string;
  /** Le rôle d'une personne : `Actor`, `Director`, `Writer`, `Creator`. */
  role?: string;
}

export interface SearchItemHit {
  item: SearchMediaItem;
  match: SearchMatch;
  score: number;
}

export interface SearchPersonHit {
  id: string;
  name: string;
  imageTag: string | null;
  /** Les rôles tenus dans la bibliothèque, les plus fréquents d'abord. */
  roles: string[];
  /** Les titres de la bibliothèque où la personne figure — et que le compte voit. */
  count: number;
  score: number;
}

/** Un genre ou un studio proposé en pastille, et ce qu'il couvre pour le compte. */
export interface SearchFacetHit {
  name: string;
  count: number;
}

export type SearchTopHit =
  | { kind: "item"; hit: SearchItemHit }
  | { kind: "person"; hit: SearchPersonHit };

export interface SearchResponse {
  query: string;
  /** Faux tant que l'index se construit : les résultats viennent alors de Jellyfin seul. */
  ready: boolean;
  tookMs: number;
  /** « Essayez avec cette orthographe » — la requête corrigée, s'il y a lieu. */
  correction: string | null;
  /** Aucun titre ne répond à TOUS les mots : ceux-ci répondent à une partie. */
  partial: boolean;
  top: SearchTopHit | null;
  movies: SearchItemHit[];
  series: SearchItemHit[];
  collections: SearchItemHit[];
  people: SearchPersonHit[];
  genres: SearchFacetHit[];
  /**
   * Les studios qui répondent. Un titre trouvé SEULEMENT par son genre ou son
   * studio ne figure dans les listes que si rien ne répond par un titre ou
   * une personne ; sinon il se replie dans sa pastille.
   */
  studios: SearchFacetHit[];
  totals: { movies: number; series: number; collections: number; people: number };
}

export interface SearchEpisodesResponse {
  query: string;
  episodes: SearchMediaItem[];
}

/** Une filmographie (personne), un genre ou un studio, parcouru dans la bibliothèque. */
export interface SearchBrowseResponse {
  person: SearchPersonHit | null;
  genre: string | null;
  studio: string | null;
  items: SearchItemHit[];
  total: number;
}

export interface SearchDiscoverResponse {
  ready: boolean;
  /** Les genres les plus fournis de ce que le compte voit. */
  genres: SearchFacetHit[];
}
