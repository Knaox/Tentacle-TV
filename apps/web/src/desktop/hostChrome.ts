/**
 * Le cadre de fenêtre que la PAGE doit dessiner elle-même.
 *
 * Sur la coquille Electron macOS, la fenêtre est fabriquée sans barre de titre
 * (`titleBarStyle: "hidden"`, voir `main/window.ts`). Ce style ne retire pas les
 * feux de circulation : il les laisse posés sur le contenu — au-dessus d'une
 * affiche, d'un titre, de la vidéo. Et comme rien ne déclarait de zone de
 * déplacement hors de la barre de navigation, dont les liens et les boutons sont
 * tous en `no-drag`, il ne restait quasiment aucune prise pour bouger la
 * fenêtre, et aucune du tout dans le lecteur.
 *
 * La page rend donc la bande que le style a enlevée. Sa hauteur vient du
 * processus principal (`main/macosTitleBar.ts`), qui s'en sert aussi pour placer
 * les feux et pour retrancher à la fenêtre de mpv : les trois doivent s'accorder
 * au point près, et une constante en regard ici finirait par diverger.
 */

import { desktopKind } from "./detect";

/**
 * Hauteur du bandeau, en points. Zéro partout où la fenêtre a un vrai cadre.
 *
 * Figée au chargement : ni la coquille ni la fabrication de la fenêtre ne
 * changent en cours de session, et cette valeur est lue à chaque rendu.
 */
const HAUTEUR = desktopKind() === "electron" ? (window.tentacle?.titleBarHeight ?? 0) : 0;

/** La page doit-elle dessiner un bandeau de fenêtre ? */
export function bandeauHote(): boolean {
  return HAUTEUR > 0;
}

/** Sa hauteur en points, `0` s'il n'y en a pas. */
export function hauteurBandeauHote(): number {
  return HAUTEUR;
}
