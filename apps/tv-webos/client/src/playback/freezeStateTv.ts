/**
 * Un gel est en cours — dit au rendu par le seul qui le sache.
 *
 * # Pourquoi il faut un canal
 *
 * Le lecteur allume son témoin de chargement sur les événements de l'élément
 * vidéo : `waiting`, `playing`, `canplay`. Sur le gel qu'on observe ici, il n'en
 * émet AUCUN — mesuré sur la dalle, cinquante secondes sans un seul événement,
 * `readyState` à 4 et neuf secondes d'avance en mémoire. Le lecteur se croit
 * prêt. Rien, de son côté, ne peut donc allumer quoi que ce soit.
 *
 * La veille de gel, elle, le voit : c'est son métier, elle échantillonne la
 * position. Mais elle vit hors du rendu — elle attrape l'élément par le document
 * plutôt que par une référence React. D'où ce magasin, qui ne transporte qu'un
 * booléen.
 *
 * # Ce que ce n'est pas
 *
 * Pas un second indicateur. Un calque supplémentaire avait été essayé puis
 * retiré, parce qu'il s'affichait EN MÊME TEMPS que le cercle du lecteur : deux
 * témoins pour une seule attente. Ici on n'ajoute rien à l'écran — on allume
 * celui qui existe déjà, via la surcouche du téléviseur qui enveloppe celle du
 * web et lui repasse ses propriétés.
 */

let frozen2 = false;
const subscribers = new Set<() => void>();

/** `useSyncExternalStore` : s'abonner aux changements. */
export function subscribeFreeze(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => subscribers.delete(onChange);
}

/** `useSyncExternalStore` : lire l'état courant. */
export function lireGel(): boolean {
  return frozen2;
}

/**
 * Poser l'état. Sans effet si rien ne change — un rendu de plus par relevé de
 * veille, toutes les deux secondes, pour une valeur identique, serait payé par
 * la dalle sans rien apporter.
 */
export function poserGel(value: boolean): void {
  if (frozen2 === value) return;
  frozen2 = value;
  for (const subscriber of subscribers) subscriber();
}
