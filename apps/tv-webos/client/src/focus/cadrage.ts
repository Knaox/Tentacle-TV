/**
 * De combien faut-il défiler pour qu'un élément soit correctement posé.
 *
 * Module pur : il ne connaît ni le DOM ni les scrollers, il compare deux
 * segments. C'est ce qui le rend testable — et il a besoin de l'être, parce
 * que le cadrage se juge sur des cas qu'on ne reproduit pas à la main : un
 * élément à cheval sur le bord, un élément plus haut que la vue, un élément
 * pile sur la marge.
 *
 * **Pourquoi ce calcul nous appartient, et ne peut pas être laissé au
 * navigateur.** `element.focus({ preventScroll: true })` n'existe qu'à partir
 * de Chrome 64 ; la dalle en a 53. Blink y exécute son propre amené-en-vue, et
 * pour un élément PARTIELLEMENT visible il le RECENTRE verticalement. Mesuré
 * sur une liste d'épisodes : en remontant, une ligne affleurant le haut de
 * l'écran était renvoyée au milieu — un demi-écran de défilement pour un appui
 * qui en demandait un dixième, et l'anneau qui « redescend » alors qu'on
 * monte. `amenerEnVue` ne rattrapait rien, puisqu'un élément recentré est dans
 * la marge et n'a plus rien à corriger. Le défaut ne se voit qu'à trois
 * mètres : sur un navigateur récent l'option est honorée et rien ne bouge.
 */

/** Une étendue sur un axe : bord d'entrée, bord de sortie. */
export interface Segment {
  debut: number;
  fin: number;
}

/**
 * La marge réellement tenable des deux côtés.
 *
 * Sur une surcouche courte — un panneau de choix de trois lignes —, deux fois
 * 96 px valent plus que la hauteur disponible : les deux bords se
 * contrediraient, et le focus oscillerait d'un appui à l'autre. On ramène donc
 * la marge à ce que la vue peut offrir, ce qui revient à centrer quand elle est
 * étroite. Nulle quand l'élément est plus grand que la vue.
 */
function margeTenable(element: Segment, vue: Segment, demandee: number): number {
  const reste = vue.fin - vue.debut - (element.fin - element.debut);
  return Math.max(0, Math.min(demandee, reste / 2));
}

/**
 * Le défilement à appliquer pour poser `element` dans `vue`, marge comprise.
 *
 * Positif fait monter l'élément à l'écran — c'est le sens d'un `scrollTop` ou
 * d'un `scrollLeft` qui augmente. Zéro quand il n'y a rien à faire : c'est le
 * cas le plus fréquent, et le seul qui garantisse qu'un déplacement horizontal
 * dans une rangée ne fasse pas trembler la page verticalement.
 *
 * Les deux bords sont traités dans l'ordre, jamais ensemble. Un élément plus
 * grand que la vue déborde des deux côtés : la marge tombe alors à zéro et
 * l'on aligne son DÉBUT, ce qu'on veut lire en premier — et surtout ce qui est
 * stable, là où corriger les deux bords tour à tour oscillerait.
 */
export function correction(element: Segment, vue: Segment, marge: number): number {
  const utile = margeTenable(element, vue, marge);

  const manqueAuDebut = element.debut - utile - vue.debut;
  if (manqueAuDebut < 0) return manqueAuDebut;

  const depasseALaFin = element.fin + utile - vue.fin;
  if (depasseALaFin > 0) return depasseALaFin;

  return 0;
}
