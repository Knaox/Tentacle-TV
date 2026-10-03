/**
 * Le focus de la FICHE d'un titre (film, série, épisode, collection) — ses
 * clés, son entrée, et les deux entrées de section qui lui sont propres. Module
 * pur : la plateforme pose le focus, déclare les entrées, piège les bouts.
 *
 * La fiche n'a pas de navigation latérale : une page poussée, la croix Retour
 * en haut à gauche — jamais l'entrée —, l'en-tête (logo, actions), puis les
 * rangées. HAUT / BAS d'une section à l'autre suivent la règle commune
 * (`sections.ts`), avec deux exceptions déclarées par la fiche :
 * - les ONGLETS des saisons entrent toujours par la saison AFFICHÉE (un
 *   sélecteur entre par sa sélection ; le focus d'un onglet ne change pas la
 *   saison, seul OK le fait) ;
 * - les ÉPISODES entrent par l'épisode à reprendre, à la première entrée de la
 *   visite seulement (la primitive « première visite » de `sectionEntry`).
 */

/** La croix Retour de la fiche. */
export const DETAIL_BACK_KEY = "detail:back";

/** La bande pleine largeur de la croix : HAUT depuis toute la page y mène. */
export const DETAIL_BACK_BAR_KEY = "detail:top";

/** La pilule de lecture. */
export const DETAIL_PRIMARY_KEY = "detail:primary";

/** La rangée des onglets de saisons, celle des épisodes. */
export const DETAIL_SEASONS_SECTION = "detail:seasons";
export const DETAIL_EPISODES_SECTION = "detail:episodes";

/**
 * Les rangées de la fiche. Leurs BOUTS retiennent le focus : de côté, rien à
 * atteindre — la fiche n'a pas de rail (FI-7).
 */
export const DETAIL_ROWS: readonly string[] = [
  DETAIL_SEASONS_SECTION,
  DETAIL_EPISODES_SECTION,
  "detail:cast",
  "detail:extras",
  "detail:saga",
  "detail:collection",
  "detail:similar",
];

export const DETAIL_ROW_EDGES = { trapLeft: true, trapRight: true } as const;

export interface DetailEntryState {
  /** La fiche n'a rien pu montrer. */
  error: boolean;
  /** L'en-tête et ses actions sont là (sinon : la fiche se charge). */
  ready: boolean;
  /** Une pilule de lecture : film, épisode, série non terminée. */
  play: boolean;
  /** Une bande-annonce. */
  trailer: boolean;
}

/**
 * L'entrée de la fiche (FI-1) : « Réessayer » sur une fiche en erreur ;
 * aucune tant qu'elle se charge ; Lecture, sinon la bande-annonce, sinon Ma
 * liste. Jamais la croix.
 */
export function detailEntryKey(state: DetailEntryState): string | null {
  if (state.error) return "status:primary";
  if (!state.ready) return null;
  if (state.play) return DETAIL_PRIMARY_KEY;
  return state.trailer ? "detail:trailer" : "detail:list";
}

/**
 * La pilule de lecture qui DISPARAÎT (une série qui se révèle terminée, apprise
 * après l'arrivée) : si elle avait le focus en dernier, la nouvelle entrée le
 * prend — jamais un écran sans focus (FI-4). `null` : rien à réclamer.
 */
export function detailEntryAfterPlayLost(state: {
  hadPlay: boolean;
  hasPlay: boolean;
  lastFocusedKey: string | null;
  entryKey: string | null;
}): string | null {
  const lost = state.hadPlay && !state.hasPlay;
  return lost && state.lastFocusedKey === DETAIL_PRIMARY_KEY ? state.entryKey : null;
}

/** L'onglet de la saison AFFICHÉE : l'entrée des onglets (FI-5) ; `null` si elle n'est pas dans la bande. */
export function detailSeasonEntryKey(seasonIds: readonly string[], selectedSeasonId: string | null | undefined): string | null {
  const index = seasonIds.findIndex((id) => id === selectedSeasonId);
  return index >= 0 ? `season:${index}` : null;
}

/**
 * L'épisode d'ANCRAGE — celui à reprendre — que la rangée des épisodes vise à
 * sa première entrée de la visite (FI-6) ; `null` sans épisode. Armée à
 * l'arrivée, désarmée au premier focus d'un épisode, réarmée à chaque saison
 * choisie (la primitive « première visite », `isDetailEpisodeKey`, la saison
 * comme clé de réarmement).
 */
export function detailEpisodeAnchorKey(episodeCount: number, anchorIndex: number | null | undefined): string | null {
  return episodeCount > 0 ? `episode:${anchorIndex ?? 0}` : null;
}

export const isDetailEpisodeKey = (key: string): boolean => key.startsWith("episode:");

/**
 * L'index de l'épisode d'ancrage dans la saison montrée (FI-8) : l'épisode
 * ouvert (fiche d'un épisode) ou celui à reprendre, s'il est dans la saison ;
 * sinon le premier.
 */
export function detailAnchorIndex(episodeIds: readonly string[] | null, highlightId: string | null | undefined): number {
  const anchor = episodeIds && highlightId ? episodeIds.indexOf(highlightId) : -1;
  return Math.max(0, anchor);
}
