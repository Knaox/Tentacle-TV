/**
 * Compteur d'images, absent du bundle téléviseur.
 *
 * Il tient une boucle `requestAnimationFrame` permanente — utile pour mesurer
 * une régression sur un poste de développement, ruineux sur le processeur
 * graphique d'une dalle, et faussant précisément la mesure qu'on voudrait
 * faire au repos.
 */

export function FrameMeter(): null {
  return null;
}

export function frameMeterEnabled(): boolean {
  return false;
}
