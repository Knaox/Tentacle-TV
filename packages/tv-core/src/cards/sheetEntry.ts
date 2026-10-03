import { RATING_ENTRY, SCALE_FOCUS_KEYS, SHEET_CLOSE_KEY, scaleFocusKey, sheetActionKey } from "./sheetKeys";

/**
 * L'ENTRÉE du grand panneau et la cible de ses trois guides — ce que le
 * branchement d'une plateforme applique, sans rien décider lui-même.
 *
 * - L'entrée : l'échelle de la note, sur la note posée, sinon sur 5/10
 *   (`RATING_ENTRY`) ; sans note à poser, le premier picto ; sans picto, la
 *   croix. Tant que la note se résout (`pending`), on attend : dans une
 *   `Modal` présentée, plus rien ne déplace le focus — le panneau ne se
 *   présente qu'une fois son entrée décidée, et elle ne bouge plus ensuite
 *   (noter ne déplace pas le focus). Un filet le présente quand même, sur le
 *   premier picto.
 * - Les guides (un par groupe, sur toute la largeur du panneau : rien n'y est
 *   aligné d'une rangée à l'autre) :
 *   - l'en-tête → la croix, une fois le verrou d'entrée levé seulement :
 *     avant, une destination tout en haut du panneau serait, là où tvOS
 *     cherche l'entrée d'une `Modal`, une cible sans issue ;
 *   - l'échelle → le cran RETENU (la note posée, sinon 5), jamais celui qui se
 *     trouve sur le chemin ; sans mémoire ;
 *   - les pictos → le dernier visité (mémoire du guide), sinon le premier.
 */

/** La note telle que le panneau la connaît. */
export interface SheetRating {
  /** La note posée, sur 10 ; `null` : aucune. */
  current: number | null;
  /** La note, ou ce qu'elle vise (la liste des notes, la série d'un épisode), se résout encore. */
  pending?: boolean;
}

/** Un picto, réduit à ce que les règles du focus en lisent. */
export interface SheetPicto {
  kind: string;
}

/** Le filet du grand panneau des cartes : une note qui tarde à se savoir ne le retient pas plus longtemps. */
export const SHEET_ENTRY_WAIT_MS = 1200;

/** Le filet du panneau d'un titre absent : son état se lit le plus souvent déjà sur sa carte. */
export const ABSENT_SHEET_ENTRY_WAIT_MS = 900;

/** Le premier picto, sinon la croix. */
export function firstPictoOf(actions: readonly SheetPicto[]): string {
  return actions[0] ? sheetActionKey(actions[0].kind) : SHEET_CLOSE_KEY;
}

/** L'entrée, une fois la note connue ; `null` tant qu'elle se résout. */
export function sheetEntryOf(rating: SheetRating | null | undefined, actions: readonly SheetPicto[]): string | null {
  if (rating?.pending) return null;
  if (rating) return scaleFocusKey(rating.current ?? RATING_ENTRY);
  return firstPictoOf(actions);
}

/** L'entrée du moment : la note sue, ou le filet écoulé (le premier picto). À figer par
 *  l'appelant dès qu'elle n'est plus `null`. */
export function sheetEntryNow(rating: SheetRating | null | undefined, actions: readonly SheetPicto[], waited: boolean): string | null {
  return sheetEntryOf(rating, actions) ?? (waited ? firstPictoOf(actions) : null);
}

/** Le panneau d'un titre absent : présenté une fois l'état du titre su (le plus souvent déjà
 *  là : la carte l'a lu pour son badge), ou au filet. Sans note, il entre par « Demander »,
 *  sinon par la croix. */
export function absentSheetEntry(actions: readonly SheetPicto[], known: boolean, waited: boolean): string | null {
  return known || waited ? sheetEntryOf(null, actions) : null;
}

/** Toutes les cibles du panneau — infocalisables, sauf l'entrée, jusqu'au premier focus (`choiceEntry`). */
export function sheetLockKeys(actions: readonly SheetPicto[]): string[] {
  return [...SCALE_FOCUS_KEYS, ...actions.map((action) => sheetActionKey(action.kind)), SHEET_CLOSE_KEY];
}

/** Le guide de l'en-tête vise la croix, une fois le verrou d'entrée levé. */
export function sheetHeaderTarget(entered: boolean): string | null {
  return entered ? SHEET_CLOSE_KEY : null;
}

/** Le guide de l'échelle vise le cran retenu : la note posée (relue au geste), sinon 5. */
export function sheetScaleTarget(rating: SheetRating | null | undefined): string {
  return scaleFocusKey(rating?.current ?? RATING_ENTRY);
}

/** Le guide des pictos vise, faute de dernier picto visité, le premier. */
export function sheetActionsTarget(actions: readonly SheetPicto[]): string | null {
  return actions[0] ? sheetActionKey(actions[0].kind) : null;
}

/** Quel guide revient au dernier élément visité de son groupe : celui des pictos seulement. */
export const SHEET_GUIDE_MEMORY = { header: false, scale: false, actions: true } as const;
