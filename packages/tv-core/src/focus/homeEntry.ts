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
/**
 * Pendant le chargement de l'accueil, le focus se tient DANS le contenu, sur
 * une ancre invisible (`HomeView`) : sans elle, tvOS le posait sur la
 * navigation — seule cible de l'écran —, qui se dépliait, puis se repliait à
 * l'arrivée du héros (retour d'essai, 2026-10-04).
 */
export const HOME_LOADING_KEY = "home:loading";

/** La clé d'une carte de rangée : `<rangée>:<index>` (`MediaRow`). */
export function rowCardKey(rowKey: string, index: number): string {
  return `${rowKey}:${index}`;
}

export interface HomeReadiness {
  /** Les vedettes ET les bibliothèques sont en échec : le panneau d'erreur. */
  failed: boolean;
  /** Chaque source a répondu (données ou échec) : les vedettes, la reprise — les deux sources du héros —, les bibliothèques. */
  featuredSettled: boolean;
  resumeSettled: boolean;
  librariesSettled: boolean;
  /** Le premier héros attend l'art de son titre (logo, fond). */
  heroPending: boolean;
}

/**
 * L'accueil se montre D'UN BLOC, en haut, sur son héros : il charge tant
 * que les sources du héros (vedettes, reprise) et les bibliothèques n'ont pas
 * répondu, ou que le premier héros attend son art. Avant, il se montrait dès
 * la première réponse : le focus se posait sur une rangée, puis le héros
 * s'insérait au-dessus et la page remontait. Les rangées qui arrivent ensuite
 * se rangent sous le héros, sans rien déplacer de ce qu'on regarde.
 */
export function homeLoading(state: HomeReadiness): boolean {
  if (state.failed) return false;
  return !state.featuredSettled || !state.resumeSettled || !state.librariesSettled || state.heroPending;
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
 * L'accueil : l'erreur → « Réessayer » ; le chargement → l'ancre invisible
 * (`HOME_LOADING_KEY`) ; l'accueil vide → aucune entrée ; un héros → sa
 * lecture ; sinon la première carte.
 */
export function homeEntryKey(state: HomeEntryState): string | null {
  if (state.failed) return STATUS_PRIMARY_KEY;
  if (state.loading) return HOME_LOADING_KEY;
  if (state.empty) return null;
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
