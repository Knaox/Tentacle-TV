/**
 * La page de résultats attend-elle encore les épisodes ?
 *
 * Module PUR — l'état de la requête des épisodes, réduit à une décision. Le
 * crochet `useHeldSearchView` s'en sert pour afficher d'UN bloc les résultats
 * et leurs épisodes.
 *
 * # Pourquoi
 *
 * Les titres viennent de l'index du serveur (quelques millisecondes), les
 * épisodes de Jellyfin (souvent plusieurs centaines). Leur section s'insérait
 * donc APRÈS coup, au-dessus des résultats hors bibliothèque : mesuré au banc
 * (épisodes à 900 ms, descente rapide dès l'ouverture), +272 px sous les
 * yeux, CLS 0,16, et la barre de défilement qui saute. L'attente est bornée
 * (`EPISODES_WAIT_MS`) : au-delà, les résultats partent sans eux.
 */

/**
 * Le plafond de l'attente des épisodes — un ARBITRAGE (lot du 15/10, « zéro
 * saut » d'abord), qu'on peut revoir.
 *
 * En deçà, résultats et épisodes paraissent d'un bloc : plus aucun saut. Au
 * delà, les résultats partent seuls et les épisodes s'insèrent à leur arrivée,
 * comme avant ce plafond — un seul saut, le temps du premier résultat restant
 * borné. Monter la valeur retarde d'autant le premier résultat quand Jellyfin
 * traîne ; la descendre rouvre le saut sur un Jellyfin ordinaire.
 */
export const EPISODES_WAIT_MS = 600;

export interface EpisodesQueryState {
  /** L'onglet montre des épisodes (« Tout », « Épisodes »). */
  wanted: boolean;
  isPending: boolean;
  isError: boolean;
  /** La réponse affichée est celle d'une requête PRÉCÉDENTE (frappe). */
  isPlaceholderData: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}

export function episodesSettled(state: EpisodesQueryState): boolean {
  if (!state.wanted || state.isError) return true;
  // Requête coupée (moins de trois lettres) : rien ne viendra, qu'il reste ou
  // non la réponse d'une requête précédente.
  if (state.fetchStatus === "idle" && (state.isPending || state.isPlaceholderData)) return true;
  return !state.isPending && !state.isPlaceholderData;
}
