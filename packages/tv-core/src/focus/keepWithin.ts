/**
 * GARDER le focus dans une surface qui couvre tout l'écran, tant qu'elle est
 * montée — le voile hors ligne.
 *
 * Le focus y entre par son entrée. S'il en sort sans revenir à l'une de ses
 * clés, c'est qu'un écran d'en dessous l'a réclamé (l'état d'erreur de
 * l'accueil naît de la même panne, une cinquantaine de millisecondes plus
 * tard) : il est ramené sur la dernière clé de la surface qui l'a tenu. Le
 * pavé, lui, ne peut pas en sortir (la surface piège le D-pad) : reprendre ne
 * contrarie jamais l'utilisateur.
 *
 * Une perte n'est jugée qu'après `KEEP_WITHIN_CHECK_MS` : le voisin qui reçoit
 * le focus peut l'annoncer après le flou de celui qui le perd. Aucune clé
 * portée (le focus dans une `Modal`, ou hors du magasin) compte comme une
 * sortie.
 *
 * Module pur : la plateforme tient le minuteur et applique la réclamation.
 */

/** Délai avant de conclure que le focus est sorti de la surface. */
export const KEEP_WITHIN_CHECK_MS = 50;

export interface KeepWithin {
  /** La dernière clé de la surface qui a tenu le focus (l'entrée, au départ). */
  readonly last: string;
}

/**
 * `ignore` : pas une clé de la surface ; `held` : une de ses clés prend le
 * focus — la vérification en attente s'annule ; `check` : une de ses clés le
 * perd — vérifier dans `KEEP_WITHIN_CHECK_MS` (la précédente s'annule).
 */
export type KeepWithinStep = { kind: "ignore" } | { kind: "held"; state: KeepWithin } | { kind: "check" };

/** La garde d'une surface qui se monte ; la plateforme réclame aussitôt `entryKey`. */
export function startKeepWithin(entryKey: string): KeepWithin {
  return { last: entryKey };
}

export function keepWithinStep(state: KeepWithin, key: string, focused: boolean, owns: (key: string) => boolean): KeepWithinStep {
  if (!owns(key)) return { kind: "ignore" };
  return focused ? { kind: "held", state: { last: key } } : { kind: "check" };
}

/** La vérification : la clé à réclamer si le focus est sorti, sinon `null`. */
export function keepWithinReclaim(state: KeepWithin, focusedKey: string | null, owns: (key: string) => boolean): string | null {
  return focusedKey !== null && owns(focusedKey) ? null : state.last;
}
