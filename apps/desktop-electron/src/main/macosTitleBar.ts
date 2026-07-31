/**
 * Le cadre de fenêtre de macOS : bandeau d'hôte, feux de circulation, et le
 * retrait que la vidéo doit lui laisser.
 *
 * # Pourquoi un bandeau, alors qu'on a retiré la barre de titre
 *
 * `titleBarStyle: "hidden"` reste indispensable — c'est lui qui fait coïncider
 * la page et le cadre (voir `window.ts`, qui dit ce qu'on voyait sans lui). Mais
 * il ne fait que RETIRER : les feux de circulation restent, et se retrouvent
 * posés sur le contenu. Ils flottaient donc au-dessus de l'affiche, du titre,
 * de la vidéo. Et comme rien ne portait `-webkit-app-region: drag` hors de la
 * barre de navigation — dont les liens et les boutons sont tous en `no-drag` —
 * il ne restait quasiment aucune prise pour déplacer la fenêtre, et aucune du
 * tout dans le lecteur.
 *
 * On rend donc la bande que le style avait enlevée, mais peinte par la page :
 * opaque, entièrement glissable, avec les feux dedans.
 *
 * # La hauteur ne vit qu'ICI
 *
 * Elle décide de trois choses qui doivent s'accorder au point près : la position
 * des feux (native), le retrait de la fenêtre de mpv (natif), et la hauteur du
 * bandeau dessiné par la page. La page la reçoit à la fabrication
 * (`additionalArguments`), comme la version et la plateforme — deux constantes
 * en regard finiraient par diverger, et le symptôme serait un liseré d'un point
 * ou des feux décentrés que personne ne saurait rattacher à sa cause.
 */

import type { BrowserWindow } from "electron";

/**
 * Hauteur du bandeau d'hôte, en points. Source unique de vérité.
 *
 * 38 : assez pour loger les feux avec de l'air au-dessus et en dessous, sans
 * prendre plus de place qu'une barre de titre de macOS (28) augmentée du confort
 * qu'attend une fenêtre sans cadre.
 */
export const HAUTEUR_BANDEAU = 38;

/**
 * Position des feux de circulation — le coin haut-gauche de leur groupe.
 *
 * Le groupe fait 12 points de haut ; `(38 - 12) / 2 = 13` le centre dans la
 * bande. En `x`, 16 points de marge : la même que celle du contenu de la page.
 */
const FEUX = { x: 16, y: 13 } as const;

/**
 * Ce que macOS ajoute à la fabrication de la fenêtre.
 *
 * Rendu en bloc plutôt qu'épelé sur place : les trois options ne se comprennent
 * qu'ensemble, et `window.ts` porte déjà tout ce que Windows exige.
 */
export function optionsCadreMacos(): Record<string, unknown> {
  if (process.platform !== "darwin") return {};
  return { transparent: true, titleBarStyle: "hidden", trafficLightPosition: FEUX };
}

/**
 * Le retrait haut que la vidéo doit laisser au bandeau.
 *
 * ⚠️ Nul en plein écran : la bande y est démontée par la page, et une vidéo qui
 * garderait le retrait laisserait une bande noire en haut de l'écran.
 *
 * `isSimpleFullScreen` compte autant que `isFullScreen` : c'est la parade de
 * Windows, mais elle est interrogeable partout et une fenêtre qui l'emprunterait
 * un jour serait servie correctement sans qu'une ligne change ici.
 */
export function retraitBandeau(host: BrowserWindow): number {
  if (process.platform !== "darwin") return 0;
  if (host.isDestroyed()) return 0;
  return host.isFullScreen() || host.isSimpleFullScreen() ? 0 : HAUTEUR_BANDEAU;
}
