/**
 * Quand l'écran de reprise se referme-t-il ? Fonction pure, pour être testée.
 *
 * **Sur une navigation POSTÉRIEURE à l'erreur, et sur elle seule.** L'erreur
 * naît le plus souvent DANS le rendu qui change d'adresse — la page qu'on ouvre
 * ne se charge pas. Comparer l'adresse à celle du rendu précédent y voyait une
 * navigation et refermait l'écran aussitôt posé : l'application remontée
 * restait sur son spinner d'amorçage tant que le serveur se taisait (mesuré au
 * simulateur webOS 25, `#root` vide pendant la coupure). On retient donc
 * l'adresse de l'erreur à sa première passe, et c'est d'elle qu'il faut
 * s'éloigner.
 */

export interface ErrorScreenState {
  error: Error | null;
  /** L'adresse (`location.key`) sous laquelle l'erreur est survenue. */
  errorKey: string | null;
}

/** Rend l'état à fusionner, ou `null` quand rien ne change. */
export function followLocation(state: ErrorScreenState, locationKey: string): Partial<ErrorScreenState> | null {
  if (!state.error) return null;
  if (state.errorKey === null) return { errorKey: locationKey };
  if (state.errorKey !== locationKey) return { error: null, errorKey: null };
  return null;
}
