/**
 * L'entrée des pages à HÉROS et à RANGÉES — l'accueil et « Pour vous » : la
 * clé que le focus vise à l'arrivée (`screenEntry.ts` la tient), selon l'état
 * de la page.
 *
 * Les clés sont celles que les vues donnent à leurs éléments (en-têtes de
 * `HomeView`, `ForYouView`, `StatusPanel`, `MediaRow`) : le bouton principal
 * du panneau d'état, celui du héros, la première carte d'une rangée.
 *
 * Module pur.
 */

/** Le bouton principal du panneau d'état (Réessayer…). */
export const STATUS_PRIMARY_KEY = "status:primary";
/** Le bouton de lecture du héros. */
export const HERO_PRIMARY_KEY = "hero:primary";

/** La clé d'une carte de rangée : `<rangée>:<index>` (`MediaRow`). */
export function rowCardKey(rowKey: string, index: number): string {
  return `${rowKey}:${index}`;
}

export interface HomeEntryState {
  /** Les vedettes ET les bibliothèques sont en échec : le panneau d'erreur. */
  failed: boolean;
  /** Le premier chargement, ou le premier héros qui attend son art. */
  loading: boolean;
  /** Rien à montrer. */
  empty: boolean;
  /** Un héros est affiché. */
  hasHero: boolean;
  /** La première rangée affichée, ou `null`. */
  firstRowKey: string | null;
}

/**
 * L'accueil : l'erreur → « Réessayer » ; le chargement ou l'accueil vide →
 * aucune entrée ; un héros → sa lecture ; sinon la première carte.
 */
export function homeEntryKey(state: HomeEntryState): string | null {
  if (state.failed) return STATUS_PRIMARY_KEY;
  if (state.loading || state.empty) return null;
  if (state.hasHero) return HERO_PRIMARY_KEY;
  return state.firstRowKey ? rowCardKey(state.firstRowKey, 0) : null;
}

export interface ForYouEntryState {
  /** Un panneau d'état remplace la page ; `withAction` : il a un bouton principal. */
  status: { withAction: boolean } | null;
  hasHero: boolean;
  /** La première étagère, ou `null`. */
  firstShelfKey: string | null;
}

/**
 * « Pour vous » : un panneau d'état → son bouton s'il en a un, sinon aucune
 * entrée ; une tête → sa lecture ; sinon la première carte.
 */
export function forYouEntryKey(state: ForYouEntryState): string | null {
  if (state.status) return state.status.withAction ? STATUS_PRIMARY_KEY : null;
  if (state.hasHero) return HERO_PRIMARY_KEY;
  return state.firstShelfKey ? rowCardKey(state.firstShelfKey, 0) : null;
}
