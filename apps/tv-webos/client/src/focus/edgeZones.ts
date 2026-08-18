/**
 * Ce que la position du pointeur demande comme défilement.
 *
 * Module PUR, sans DOM : il ne connaît que des coordonnées, un canevas et un
 * retrait d'overscan. C'est ce qui le rend vérifiable au bureau, là où le geste
 * lui-même ne l'est pas.
 *
 * Le comportement visé est celui de webOS : le curseur posé près d'un bord fait
 * défiler la vue dans cette direction, d'autant plus vite qu'on s'en approche.
 * La télécommande de LG n'a pas de molette, et pointer une carte trois écrans
 * plus bas suppose bien un moyen de descendre sans reprendre le D-pad.
 */

/** Le canevas de l'application, en pixels CSS. */
export interface Canevas {
  largeur: number;
  hauteur: number;
}

/** Le retrait d'overscan, par axe. */
export interface Retrait {
  x: number;
  y: number;
}

/** Ce que le curseur demande, en pixels par seconde. Négatif = vers le début. */
export interface Poussee {
  x: number;
  y: number;
}

/**
 * Profondeur des bandes, en pixels de canevas.
 *
 * La bande commence à l'INTÉRIEUR de la zone sûre, et c'est la seule façon
 * qu'elle soit atteignable : un téléviseur rogne jusqu'à cinq pour cent de
 * chaque bord, et une bande cantonnée à ces pixels-là serait hors de l'écran
 * chez la moitié des gens. Elle vaut donc l'overscan plus une marge utile.
 *
 * La verticale est volontairement moins profonde que l'horizontale. Descendre
 * est le geste courant, et une bande épaisse se déclencherait alors qu'on vise
 * simplement une carte de la dernière rangée. Aller à droite dans une rangée
 * est plus rare, et plus intentionnel.
 */
export const MARGE_UTILE_X = 64;
export const MARGE_UTILE_Y = 66;

/** Vitesses extrêmes, en pixels par seconde. */
export const VITESSE_MIN = 240;
export const VITESSE_MAX = 1600;

/**
 * Part de la bande où l'on ne défile pas encore.
 *
 * Un curseur posé un pixel dans la bande ne doit pas faire dériver la page :
 * on l'y a mis pour viser ce qui s'y trouve, pas pour défiler.
 */
export const ZONE_MORTE = 0.06;

/** Profondeur d'une bande sur un axe, retrait d'overscan compris. */
export function bande(retrait: number, margeUtile: number): number {
  return retrait + margeUtile;
}

/**
 * Où se trouve la position dans la bande : 0 au bord intérieur, 1 au bord de
 * la dalle. Rend 0 hors de la bande, et ne dépasse jamais 1 — un pointeur dans
 * l'overscan ne va pas plus vite que le maximum.
 */
export function profondeur(distanceAuBord: number, profondeurBande: number): number {
  if (profondeurBande <= 0) return 0;
  const dedans = (profondeurBande - distanceAuBord) / profondeurBande;
  if (dedans <= 0) return 0;
  return dedans > 1 ? 1 : dedans;
}

/**
 * La courbe de vitesse : quadratique, et non linéaire.
 *
 * Effleurer la bande doit faire ramper — c'est ce qui permet de s'arrêter sur
 * la bonne rangée — et s'y coller doit faire filer. Une droite donne trop de
 * vitesse dès l'entrée dans la bande : on dépasse toujours sa cible, et le
 * geste devient une lutte.
 *
 * Aux bornes : 240 px/s, soit quatre secondes et demie pour un écran ; 1600,
 * soit deux tiers de seconde. La zone morte est retranchée AVANT la mise à
 * l'échelle, sans quoi le premier pixel utile partirait déjà à 240.
 */
export function vitesse(fraction: number): number {
  if (fraction <= ZONE_MORTE) return 0;
  const utile = (fraction - ZONE_MORTE) / (1 - ZONE_MORTE);
  return VITESSE_MIN + (VITESSE_MAX - VITESSE_MIN) * utile * utile;
}

/**
 * Ce que le curseur demande, sur les deux axes.
 *
 * Les deux sont rendus ensemble : dans un coin, on défile en diagonale, ce que
 * fait aussi le système. L'appelant décide ensuite ce qu'il peut réellement
 * faire bouger — la page pour la verticale, une rangée pour l'horizontale.
 */
export function poussee(x: number, y: number, canevas: Canevas, retrait: Retrait): Poussee {
  const bandeX = bande(retrait.x, MARGE_UTILE_X);
  const bandeY = bande(retrait.y, MARGE_UTILE_Y);
  return {
    x: composante(x, canevas.largeur, bandeX),
    y: composante(y, canevas.hauteur, bandeY),
  };
}

/**
 * Un axe. Le signe dit le sens ; la valeur, la vitesse.
 *
 * Le bord le plus proche gagne quand la fenêtre est plus étroite que deux
 * bandes — cas d'école sur un canevas de téléviseur, mais un panneau modal
 * peut, lui, être étroit.
 */
function composante(position: number, taille: number, profondeurBande: number): number {
  const versLeDebut = profondeur(position, profondeurBande);
  const versLaFin = profondeur(taille - position, profondeurBande);
  if (versLeDebut > versLaFin) return -vitesse(versLeDebut);
  if (versLaFin > 0) return vitesse(versLaFin);
  return 0;
}
