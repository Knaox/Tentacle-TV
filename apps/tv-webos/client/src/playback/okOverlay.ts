/**
 * À qui appartient OK quand l'habillage est éteint.
 *
 * Deux surcouches paraissent alors que l'habillage s'est retiré depuis
 * longtemps : le bouton « passer l'intro », et la carte « épisode suivant ».
 * À cet instant le moteur de focus n'est plus sur la route — les flèches
 * appartiennent au déplacement dans le flux — et rien ne permettrait de viser
 * ce qui vient d'arriver.
 *
 * La parade d'`apps/tv` : la surcouche PREND le focus en paraissant, les
 * flèches gardent leur sens, et un seul geste change de propriétaire. Ce qui
 * suffit, puisqu'il n'y a qu'une chose à faire de ces surcouches-là.
 *
 * L'attribut se pose sur un CONTENEUR, pas sur un bouton : la carte « épisode
 * suivant » en a deux, et laisser OK à l'un et pas à l'autre serait un piège.
 */

export const ATTRIBUT_SURCOUCHE = "data-osd-surcouche";

/**
 * Active l'élément focalisé s'il appartient à une surcouche qui possède OK.
 *
 * Rend `false` sinon — l'appelant reprend alors son cours.
 */
export function activerSurcoucheFocalisee(): boolean {
  const actif = document.activeElement;
  if (!(actif instanceof HTMLElement)) return false;
  if (!actif.closest(`[${ATTRIBUT_SURCOUCHE}]`)) return false;
  actif.click();
  return true;
}

/**
 * Une surcouche est-elle à l'écran ?
 *
 * Quand il y a quelque chose à faire, les flèches servent à le viser — pas à
 * déplacer la lecture derrière. C'est la même règle que sous l'habillage :
 * **tant qu'une chose est affichée, les touches lui appartiennent.**
 *
 * Ces surcouches sont montées à la demande, jamais laissées en place à opacité
 * nulle — leur seule présence dans le document vaut donc affichage.
 */
export function surcoucheAffichee(): boolean {
  return !!document.querySelector(`[${ATTRIBUT_SURCOUCHE}]`);
}
