import type { SwipeCard } from "./swipeTypes";

/**
 * L'empilement de la pile, commun au web et au mobile : il suit l'ordre
 * d'ARRIVÉE des cartes, jamais leur place dans la liste rendue. La plus
 * ancienne est dessus — en tête de pile comme en partance : une carte jugée
 * garde le dessus pendant toute sa sortie, deux sorties rapprochées restent
 * dans l'ordre, une carte rendue par « annuler » repasse devant.
 *
 * Le rang est gardé par OBJET, hors de React : les cartes de la file sont
 * stables (celle que rend « annuler » est le même objet que celle qui était
 * partie), une carte neuve prend le rang suivant. Le z-index décroît avec le
 * rang ; le conteneur de la pile doit l'isoler du reste de la page.
 */
const arrival = new WeakMap<SwipeCard, number>();
let nextArrival = 0;
const TOP_Z = 1_000_000;

export function swipeStackZ(card: SwipeCard): number {
  let rank = arrival.get(card);
  if (rank === undefined) {
    rank = nextArrival++;
    arrival.set(card, rank);
  }
  return TOP_Z - rank;
}
