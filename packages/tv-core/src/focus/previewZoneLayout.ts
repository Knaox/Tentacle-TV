import type { RevealSpec } from "./reveal";

/**
 * La ZONE FIXE de l'aperçu et la page qui défile DESSOUS (Apple TV, Android
 * TV — décision du 18/10, façon Netflix au salon) : l'Accueil, « Pour vous »
 * et les grilles (bibliothèque, Ma liste, Favoris, Parcourir, collection).
 *
 * - La zone occupe le haut de l'écran (`PREVIEW_ZONE_HEIGHT`, 40 % de la
 *   hauteur) : l'aperçu de la carte focalisée s'y joue, toujours au même
 *   endroit. Elle ne défile jamais.
 * - La page — rangées, lignes de grille — défile DANS la fenêtre sous la zone
 *   (`BELOW_ZONE_VIEWPORT`), jamais SOUS elle : tvOS ne focalise pas un
 *   élément recouvert par ce qui dessine, et la rangée du dessus deviendrait
 *   inatteignable.
 * - La section focalisée (une rangée, une ligne) se pose TOUJOURS au même
 *   endroit, juste sous la zone (`BELOW_ZONE_REVEAL` : son haut à
 *   `BELOW_ZONE_ANCHOR_TOP` du haut de la fenêtre) — la position verticale du
 *   focus est constante, seule la page bouge, d'un mouvement (la règle :
 *   `reveal.ts`, mode `anchor`, appliquée nativement sur les deux
 *   plateformes). Rien ne grandit, aucune remise en page au changement de
 *   focus.
 * - La page commence au moins à `BELOW_ZONE_ANCHOR_TOP` (sa marge du haut, ou
 *   un en-tête) : la PREMIÈRE section s'y pose sans défiler. Sa marge du bas
 *   (`belowZoneBottomRoom`) laisse la DERNIÈRE section s'y poser comme les
 *   autres : sans elle, la page s'arrêterait à son contenu et la dernière
 *   rangée resterait plus bas.
 *
 * Module pur : des nombres, en points de la scène (1920 × 1080).
 */

/** La hauteur de la scène. */
export const PREVIEW_STAGE_HEIGHT = 1080;

/** La zone de l'aperçu : 40 % de la hauteur de l'écran, en haut. */
export const PREVIEW_ZONE_HEIGHT = 432;

/** La fenêtre de la page, sous la zone. */
export const BELOW_ZONE_VIEWPORT = PREVIEW_STAGE_HEIGHT - PREVIEW_ZONE_HEIGHT;

/**
 * Le haut de la section focalisée, depuis le haut de la fenêtre : la place de
 * l'agrandissement de la carte au focus (une affiche de grille grandit depuis
 * son centre) et de sa lueur, sans toucher la zone. C'est aussi la marge du
 * haut minimale de la page.
 */
export const BELOW_ZONE_ANCHOR_TOP = 32;

/** Comment la page montre une rangée ou une ligne de grille sous la zone : toujours au même endroit. */
export const BELOW_ZONE_REVEAL = { mode: "anchor", top: BELOW_ZONE_ANCHOR_TOP } as const satisfies RevealSpec;

/**
 * La marge du bas d'une page sous la zone : ce qu'il faut sous la DERNIÈRE
 * section (de hauteur `lastSectionHeight`) pour qu'elle se pose à
 * `anchorTop`, comme les autres — jamais négative.
 */
export function belowZoneBottomRoom(lastSectionHeight: number, viewport: number = BELOW_ZONE_VIEWPORT, anchorTop: number = BELOW_ZONE_ANCHOR_TOP): number {
  return Math.max(0, Math.ceil(viewport - anchorTop - lastSectionHeight));
}
