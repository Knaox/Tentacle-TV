/**
 * L'ENTRÉE d'un groupe d'éléments — une rangée, un panneau, une liste : quand
 * le focus y arrive d'ailleurs, sur quel élément il atterrit.
 *
 * Le dernier élément du groupe qui a eu le focus, s'il est encore monté (on
 * revient où on était) ; sinon, ou quand le groupe ne se souvient pas,
 * l'entrée par défaut que donne l'intégration — l'onglet de la saison
 * affichée, l'épisode à reprendre, la première carte, Lecture.
 *
 * Sans cette décision, tvOS vise l'élément situé sous le point de départ —
 * et rien du tout quand aucun élément du groupe ne le chevauche (HAUT depuis
 * la droite de l'écran). La plateforme pose la décision d'avance (tvOS : la
 * destination d'un guide de focus, relue à chaque rendu et à chaque focus pris
 * dans le groupe) ; sans cible, le guide ne doit rien capter.
 *
 * Module pur.
 */

export interface GroupEntryInput {
  /** Revenir au dernier élément visité (le défaut des groupes). */
  remember: boolean;
  /** Le dernier élément du groupe qui a eu le focus. */
  last: string | null;
  isMounted: (key: string) => boolean;
  /** L'entrée par défaut, lue au moment de la décision. */
  fallback: () => string | null;
}

/** L'élément sur lequel le focus entre dans le groupe, ou `null` : aucune cible. */
export function groupEntryKey({ remember, last, isMounted, fallback }: GroupEntryInput): string | null {
  return remember && last && isMounted(last) ? last : fallback();
}
