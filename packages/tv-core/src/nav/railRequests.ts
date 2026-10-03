import type { BackLayerSpec } from "./backResolve";

/**
 * Les demandes en cours (Vigie) dans le rail — l'APERÇU au-dessus du profil
 * et sa FENÊTRE « Mes demandes ». Module pur : ce que le focus peut y faire.
 *
 * - L'aperçu n'est pas une page : pendant le déplacement d'une entrée du
 *   rail, il est infocalisable, comme le profil — rien ne s'y pose.
 * - La fenêtre est en lecture seule ; sa croix en est la SEULE action : elle
 *   prend l'entrée (l'élément du haut, que tvOS choisit dans une Modal), sous
 *   la garde anti-clic fantôme — la fenêtre s'ouvre sous un OK encore
 *   enfoncé. Les lignes ne deviennent focalisables que pour faire défiler une
 *   liste qui dépasse la hauteur de la fenêtre.
 * - Retour la ferme (couche « menu »), le temps de sa sortie compris : une
 *   fois la sortie lancée, la couche se retire.
 */

/** La fenêtre montre quatre lignes et demie ; au-delà, la liste défile. */
export const REQUESTS_VISIBLE_ROWS = 4;

/** Les lignes sont focalisables seulement quand la liste dépasse. */
export function requestsRowsFocusable(count: number): boolean {
  return count > REQUESTS_VISIBLE_ROWS;
}

/** L'aperçu est verrouillé pendant le déplacement d'une entrée du rail. */
export function requestsDockLocked(moving: boolean): boolean {
  return moving;
}

/** La croix de la fenêtre est gardée du clic fantôme. */
export const REQUESTS_CLOSE_GUARDED = true;

/** La couche du Retour de la fenêtre : active tant que sa sortie n'est pas lancée. */
export function requestsPanelBackLayers(closing: boolean): BackLayerSpec<"close">[] {
  return [{ id: "close", kind: "menu", active: !closing, action: "close" }];
}
