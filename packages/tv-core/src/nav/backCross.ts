import { isNavKey } from "./railKeys";

/**
 * La CROIX Retour d'un écran — le bouton Retour posé en haut à gauche de ce
 * qu'il referme (fiche, Parcourir, jumelage, erreurs d'écran). Module pur :
 * l'adaptateur verrouille la croix, arme sa bande et pose `nextFocusDown`
 * selon ce qu'il décide.
 *
 * - JAMAIS L'ENTRÉE, sauf seule action : à l'arrivée — et à chaque nouvelle
 *   étape d'un automate —, la croix est infocalisable tant que le focus ne
 *   s'est pas posé ailleurs. Sinon tvOS la choisit, cible la plus en haut à
 *   gauche, avant que l'entrée ne se monte, et le premier focus de contenu
 *   clôt l'arrivée : elle le gardait. Quand elle EST l'entrée (seule action),
 *   rien n'est verrouillé.
 * - Libérée au premier focus de n'importe quelle autre clé de l'écran
 *   (contenu ou navigation), ou dès qu'elle devient l'entrée.
 * - HAUT depuis n'importe où dessous : sa bande pleine largeur la vise
 *   (tvOS ne vise que ce qui CHEVAUCHE) — armée seulement croix libre et focus
 *   hors de la navigation (la capsule ouverte du rail passe au-dessus de la
 *   bande). Sans destination, la bande n'est pas une cible.
 * - BAS depuis la croix : la dernière cible de contenu encore montée, sinon
 *   l'entrée de l'écran — jamais la croix elle-même.
 */

/** À l'arrivée (ou à une nouvelle étape) : verrouiller la croix ? Non si elle est l'entrée. */
export function backCrossLockedOnArrival(entryKey: string | null, backKey: string): boolean {
  return entryKey !== backKey;
}

/** Un focus se pose ailleurs que sur la croix : la libère. */
export function backCrossFreedBy(focusKey: string, backKey: string): boolean {
  return focusKey !== backKey;
}

/** Ce focus se retient comme « dernière cible de contenu » pour BAS : hors de la navigation. */
export function backCrossRemembers(focusKey: string): boolean {
  return !isNavKey(focusKey);
}

/** La bande vise la croix : croix libre, et le focus hors de la navigation (aucun focus compris). */
export function backCrossBandArmed(locked: boolean, focusedKey: string | null): boolean {
  return !locked && !isNavKey(focusedKey);
}

/** BAS depuis la croix : la dernière cible de contenu encore montée, sinon l'entrée ; jamais la croix. */
export function backCrossDownTarget(state: {
  lastContent: string | null;
  lastContentMounted: boolean;
  entryKey: string | null;
  backKey: string;
}): string | null {
  const target = state.lastContent && state.lastContentMounted ? state.lastContent : state.entryKey;
  return target && target !== state.backKey ? target : null;
}
