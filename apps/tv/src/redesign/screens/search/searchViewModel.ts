import { TV_STAGE } from "@tentacle-tv/theme";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import type { MetaItem } from "../../hero/MetaLine";

/**
 * Le modèle de la vue « Recherche » — tout arrive RÉSOLU : textes traduits,
 * images en adresses prêtes, marqueurs par le modèle partagé, rangées dans
 * l'ordre de `tvSearchSections` (tv-core). La vue ne connaît ni le moteur,
 * ni Jellyfin, ni le vrai champ de saisie.
 */

/** Une suggestion : la complétion du meilleur résultat, ou une requête proposée. */
export interface SearchSuggestionModel {
  query: string;
  kind: "complete" | "query";
}

/** Le meilleur résultat, quand c'est un titre. */
export interface SearchTopTitleModel {
  kind: "title";
  id: string;
  title: string;
  logoUri?: string;
  backdropUri?: string;
  /** « Film · 2008 · ★ 8,5 », puis les pastilles qualité. */
  meta: MetaItem[];
  /** Pourquoi il répond (« Avec Keira Knightley ») ; absent quand c'est son titre. */
  reason?: string;
  /** 0 à 1 : une lecture entamée. */
  progress?: number;
  palette: ArtworkPalette;
}

/** Le meilleur résultat, quand c'est une personne. */
export interface SearchTopPersonModel {
  kind: "person";
  id: string;
  name: string;
  imageUri?: string;
  initials: string;
  /** « Interprétation — 4 titres ». */
  detail: string;
  /** « Voir la filmographie ». */
  action: string;
  /** La lumière d'un de ses titres ; neutre sinon. */
  palette?: ArtworkPalette;
}

export type SearchTopModel = SearchTopTitleModel | SearchTopPersonModel;

export interface SearchPersonModel {
  id: string;
  name: string;
  imageUri?: string;
  initials: string;
  /** « Interprétation — 4 titres ». */
  detail?: string;
}

export interface SearchFacetModel {
  kind: "genre" | "studio";
  name: string;
  /** « Studio · 14 titres ». */
  detail: string;
}

/** Une rangée de résultats. Les clés de focus : `top`, puis `${key}:${index}`. */
export type SearchSectionModel =
  | { key: "top"; label: string; top: SearchTopModel }
  | { key: "movies" | "series" | "collections" | "episodes"; title: string; count?: string; cards: CardModel[] }
  | { key: "people"; title: string; people: SearchPersonModel[] }
  | { key: "facets"; title: string; facets: SearchFacetModel[] };

/** Une seule phrase au-dessus des rangées. */
export type SearchNoticeModel =
  | { kind: "correction"; lead: string; correction: string }
  | { kind: "partial" | "indexing"; text: string };

/** Ce que la colonne de droite montre sans résultats : ce que le moteur
 *  comprend, les recherches récentes, les genres à parcourir. */
export interface SearchDiscoverModel {
  title: string;
  hint: string;
  recentsTitle: string;
  recents: string[];
  genresTitle: string;
  genres: Array<{ name: string; detail: string }>;
}

export type SearchContentModel =
  | { kind: "idle" | "empty"; discover: SearchDiscoverModel }
  | { kind: "loading"; label: string }
  | {
      kind: "results";
      notice: SearchNoticeModel | null;
      /** La réponse montrée est celle d'une frappe précédente : lisible, atténuée. */
      stale: boolean;
      sections: SearchSectionModel[];
    };

export interface SearchInputLabels {
  /** Le champ vide : « Titres, acteurs, genres… ». */
  placeholder: string;
  /** tvOS : où est la dictée (le clavier système, pas un micro de l'app). */
  dictationHint: string;
  suggestions: string;
  space: string;
  delete: string;
  clear: string;
  mic: string;
}

// ─── La mise en page ─────────────────────────────────────────────────────────

export const KEY_SIZE = 64;
export const KEY_GAP = 8;
/** Six touches par rangée : A–Z puis 0–9. */
export const KEYBOARD_WIDTH = KEY_SIZE * 6 + KEY_GAP * 5;
/** La colonne de saisie commence après la navigation repliée. */
export const INPUT_LEFT = TV_STAGE.contentLeft;
/** Les résultats : après la colonne de saisie et un vrai blanc. */
export const RESULTS_LEFT = INPUT_LEFT + KEYBOARD_WIDTH + 72;
/** La colonne des résultats est rognée un peu avant sa première carte : de
 *  quoi laisser l'agrandissement et l'ombre du focus sans rien montrer sous
 *  le clavier quand une rangée défile. */
export const RESULTS_CLIP = 60;
/** La largeur utile des résultats (jusqu'à la marge de sécurité). */
export const RESULTS_WIDTH = 1920 - RESULTS_LEFT - TV_STAGE.safe.x;
