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

/** Sous la section focalisée, jusqu'au bord bas de l'écran : rien ne s'y colle. */
export const BELOW_ZONE_BOTTOM_MARGIN = 16;

/**
 * Le haut de la section focalisée, depuis le haut de la fenêtre : la place du
 * léger agrandissement de la carte au FOCUS (`CARD_FOCUS_SCALE`, × 1,08 —
 * une affiche de grille le prend depuis son centre, donc aussi vers le haut)
 * et de sa lueur, sans toucher la zone. Rien à voir avec l'aperçu, qui ne
 * fait rien grandir. C'est aussi la marge du haut minimale de la page.
 */
export const BELOW_ZONE_ANCHOR_TOP = 32;

/** Comment la page montre une rangée ou une ligne de grille sous la zone : toujours au même endroit. */
export const BELOW_ZONE_REVEAL = { mode: "anchor", top: BELOW_ZONE_ANCHOR_TOP } as const satisfies RevealSpec;

/**
 * La plus haute IMAGE de carte qu'une rangée peut montrer sous la zone
 * (18/10, relevé du testeur : une étagère d'affiches de « Pour vous », en
 * taille Grande, sortait par le bas — titre 43, affiche au focus 505,
 * légende, « Maintenir OK » : ≈ 680 pour une fenêtre de 648). Sa section
 * focalisée — `chrome`, tout sauf l'image (le titre de la rangée, ses
 * écarts, la légende, le pied), plus l'image agrandie au focus
 * (`focusScale`) — tient dans la fenêtre, ancrée, à `BELOW_ZONE_BOTTOM_MARGIN`
 * du bas de l'écran. La zone garde sa hauteur sur toutes les pages (le texte
 * du héros y tient) ; ce sont les affiches d'une rangée qui ne dépassent pas
 * ce plafond, quelle que soit la taille des cartes réglée. Les vignettes 16:9
 * et les grilles en sont loin.
 */
export function belowZoneFrameCap(chrome: number, focusScale: number, viewport: number = BELOW_ZONE_VIEWPORT, anchorTop: number = BELOW_ZONE_ANCHOR_TOP): number {
  return Math.floor((viewport - anchorTop - BELOW_ZONE_BOTTOM_MARGIN - chrome) / Math.max(1, focusScale));
}

/**
 * La marge du bas d'une page sous la zone : ce qu'il faut sous la DERNIÈRE
 * section (de hauteur `lastSectionHeight`) pour qu'elle se pose à
 * `anchorTop`, comme les autres — jamais négative.
 */
export function belowZoneBottomRoom(lastSectionHeight: number, viewport: number = BELOW_ZONE_VIEWPORT, anchorTop: number = BELOW_ZONE_ANCHOR_TOP): number {
  return Math.max(0, Math.ceil(viewport - anchorTop - lastSectionHeight));
}
