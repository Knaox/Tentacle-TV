/**
 * Les RANGÉES d'une collection — une bibliothèque, Ma liste, Mes favoris — au
 * lieu d'une grille (banc de « la carte qui s'ouvre », validé par Damien le
 * 19/10) : la même taille de carte partout, les titres rangés en rangées par
 * genre, par décennie, par lettres, par note — ou par type pour une liste. La
 * pastille « Ranger par » vient en tête de la barre de filtres ; les filtres
 * s'appliquent DANS chaque rangée.
 *
 * Ce module dit les modes et le titre d'un groupe ; l'intégration le met en
 * mots (`GroupLabel` → i18n). Les règles : `listGroups.ts` (une liste, toute
 * en mémoire) et `libraryGroups.ts` (une bibliothèque, groupe par groupe).
 */

export type GroupMode = "genre" | "year" | "alpha" | "rating" | "type";

/** Une bibliothèque : le catalogue est sur le serveur, chaque rangée est une requête. */
export const LIBRARY_GROUP_MODES = ["genre", "year", "alpha", "rating"] as const satisfies readonly GroupMode[];
/** Ma liste, Mes favoris : toute la liste est en mémoire. */
export const LIST_GROUP_MODES = ["type", "genre", "alpha"] as const satisfies readonly GroupMode[];

export type LibraryGroupMode = (typeof LIBRARY_GROUP_MODES)[number];
export type ListGroupMode = (typeof LIST_GROUP_MODES)[number];

export const DEFAULT_LIBRARY_GROUP: LibraryGroupMode = "genre";
export const DEFAULT_LIST_GROUP: ListGroupMode = "type";

/** Le titre d'une rangée, avant les mots. */
export type GroupLabel =
  | { kind: "genre"; name: string }
  | { kind: "otherGenres" }
  | { kind: "decade"; decade: number }
  | { kind: "before"; year: number }
  | { kind: "letters"; from: string; to: string }
  | { kind: "digits" }
  | { kind: "ratingAtLeast"; min: number }
  | { kind: "ratingBetween"; min: number; max: number }
  | { kind: "ratingBelow"; max: number }
  | { kind: "noRating" }
  | { kind: "type"; type: "movies" | "series" | "anime" };

/** Les tranches de lettres (« A – C », « D – F »…), puis « 0 – 9 » : tout ce qui ne commence pas par une lettre. */
export const LETTER_RANGES: readonly (readonly [string, string])[] = [
  ["A", "C"], ["D", "F"], ["G", "I"], ["J", "L"], ["M", "O"], ["P", "R"], ["S", "U"], ["V", "Z"],
];

/** Les paliers de la note (sur 10) : « 8 et plus », « De 7 à 8 », « De 6 à 7 », « Moins de 6 ». */
export const RATING_STEPS: readonly number[] = [8, 7, 6];

/** La première décennie qui a sa rangée ; ce qui la précède est réuni (« Avant 1970 »). */
export const FIRST_DECADE = 1970;

/** Un genre de moins de titres que ça rejoint « Autres genres » (rien de perdu, moins de rangées maigres). */
export const SMALL_GENRE = 3;

/** La première lettre d'un titre, sans accent ni signe ; "" s'il ne commence ni par une lettre ni par un chiffre. */
export function initialOf(title: string): string {
  const plain = title.normalize("NFD").replace(/[^A-Za-z0-9]/g, "");
  return plain.charAt(0).toUpperCase();
}

/** L'index de la tranche de lettres d'un titre ; `LETTER_RANGES.length` : « 0 – 9 ». */
export function letterRangeOf(title: string): number {
  const initial = initialOf(title);
  const at = LETTER_RANGES.findIndex(([from, to]) => initial >= from && initial <= to && /[A-Z]/.test(initial));
  return at < 0 ? LETTER_RANGES.length : at;
}

export function letterLabel(index: number): GroupLabel {
  const range = LETTER_RANGES[index];
  return range ? { kind: "letters", from: range[0], to: range[1] } : { kind: "digits" };
}

/** Le palier d'une note : son index dans `RATING_STEPS`, `RATING_STEPS.length` en dessous du dernier, -1 sans note. */
export function ratingStepOf(rating: number | null | undefined): number {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return -1;
  const at = RATING_STEPS.findIndex((min) => rating >= min);
  return at < 0 ? RATING_STEPS.length : at;
}

export function ratingLabel(step: number): GroupLabel {
  if (step < 0) return { kind: "noRating" };
  if (step === 0) return { kind: "ratingAtLeast", min: RATING_STEPS[0] };
  if (step >= RATING_STEPS.length) return { kind: "ratingBelow", max: RATING_STEPS[RATING_STEPS.length - 1] };
  return { kind: "ratingBetween", min: RATING_STEPS[step], max: RATING_STEPS[step - 1] };
}

/** La décennie d'une année (2014 → 2010) ; avant `FIRST_DECADE` : la rangée « Avant ». */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}
