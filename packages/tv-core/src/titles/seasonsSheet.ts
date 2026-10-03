import type { RemoteIntent } from "../remote/intents";
import { hasAllSeasonsRow, shortcutSeasons, type SeasonsSheetFocus } from "./seasonsShortcut";

/**
 * Le FOCUS de la feuille des saisons d'une TV — ses cibles, son entrée, et
 * quand elle se présente. Ce que font OK et Lecture/Pause : `seasonsShortcut`.
 *
 * - Les cibles : « Toutes les saisons manquantes » (dès deux saisons à
 *   demander), chaque saison à cocher, puis la pilule du pied. Les saisons
 *   déjà demandées ou dans la bibliothèque ne prennent pas le focus.
 * - L'entrée (figée) : la saison choisie (l'onglet grisé d'une fiche, cochée
 *   d'avance) si elle se demande, sinon la première à cocher — jamais
 *   « Toutes » —, sinon la pilule.
 * - Elle se présente une fois les saisons SUES (et, pour une série de la
 *   bibliothèque, celles qu'elle a déjà), à l'échec, ou au filet : dans une
 *   `Modal` présentée, plus rien ne déplace le focus.
 * - BAS depuis n'importe quelle ligne mène au pied (groupe
 *   `SEASONS_FOOTER_GROUP`, qui entre par la pilule).
 */

/** La ligne « Toutes les saisons manquantes ». */
export const SEASONS_ALL_KEY = "sheet:season:all";

/** Une saison à cocher (`sheet:season:3`). */
export const seasonFocusKey = (number: number): string => `sheet:season:${number}`;

/** La pilule du pied : « Demander N saisons », ou « Fermer ». */
export const SEASONS_APPLY_KEY = "sheet:apply";

/** Le groupe du pied. */
export const SEASONS_FOOTER_GROUP = "sheet:footer";

/** Le filet : des saisons qui tardent ne retiennent pas la feuille. */
export const SEASONS_SHEET_ENTRY_WAIT_MS = 1500;

const SEASON_KEY = /^sheet:season:(\d+)$/;

/** Les cibles de la feuille, dans l'ordre : « Toutes » (dès deux), les saisons à cocher, la pilule. */
export function seasonsSheetKeys(requestable: readonly number[]): string[] {
  return [...(hasAllSeasonsRow(requestable) ? [SEASONS_ALL_KEY] : []), ...requestable.map(seasonFocusKey), SEASONS_APPLY_KEY];
}

/** L'entrée : la saison choisie si elle se demande, sinon la première à cocher, sinon la pilule. */
export function seasonsSheetEntry(requestable: readonly number[], chosen?: number): string {
  const first = chosen !== undefined && requestable.includes(chosen) ? chosen : requestable[0];
  return first !== undefined ? seasonFocusKey(first) : SEASONS_APPLY_KEY;
}

export interface SeasonsSheetReadiness {
  /** L'extension a dit les saisons. */
  answered: boolean;
  /** Les saisons qu'a la bibliothèque sont sues (sans série de la bibliothèque : d'emblée). */
  ownedKnown: boolean;
  /** Leur lecture a échoué. */
  failed: boolean;
  /** Le filet est écoulé. */
  waited: boolean;
}

/** L'entrée peut se décider — la feuille se présente. */
export function seasonsSheetReady({ answered, ownedKnown, failed, waited }: SeasonsSheetReadiness): boolean {
  return (answered && ownedKnown) || failed || waited;
}

/** Ce qui a le focus, tel que le raccourci Lecture/Pause le lit. */
export function seasonsSheetFocusOf(key: string | null): SeasonsSheetFocus {
  if (key === SEASONS_ALL_KEY) return { kind: "all" };
  const season = key ? SEASON_KEY.exec(key) : null;
  return season ? { kind: "season", number: Number(season[1]) } : { kind: "other" };
}

/** OK sur une saison : cochée, ou décochée si elle l'était. */
export function toggleSeason(checked: ReadonlySet<number>, number: number): Set<number> {
  const next = new Set(checked);
  if (next.has(number)) next.delete(number);
  else next.add(number);
  return next;
}

/** Ce que demande la pilule « Demander N saisons » : les saisons cochées, dans leur ordre. */
export function checkedSeasons(requestable: readonly number[], checked: ReadonlySet<number>): number[] {
  return requestable.filter((number) => checked.has(number));
}

/** Une demande part avec au moins une saison, et une seule à la fois. */
export function canSubmitSeasons(seasons: readonly number[], sending: boolean): boolean {
  return !sending && seasons.length > 0;
}

/** Ce que la feuille fait d'une intention : Lecture/Pause demande. */
export interface SeasonsSheetDecision {
  /** Les saisons à demander ; vide : rien ne part. */
  seasons: number[];
}

/**
 * La feuille PREND Lecture/Pause — l'appui simple, jamais le maintien — et
 * demande ce que dit le raccourci (`shortcutSeasons`) ; vide, rien ne part.
 * Toute autre intention suit son cours (le focus natif, Retour).
 */
export function seasonsSheetIntent(
  intent: RemoteIntent,
  requestable: readonly number[],
  checked: ReadonlySet<number>,
  focus: SeasonsSheetFocus,
): SeasonsSheetDecision | null {
  return intent.type === "playPause" ? { seasons: shortcutSeasons(requestable, checked, focus) } : null;
}

/** Le pied ne retient que sa pilule. */
export function isSeasonsFooterKey(key: string): boolean {
  return key === SEASONS_APPLY_KEY;
}
