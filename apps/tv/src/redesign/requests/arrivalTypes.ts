import type { ArrivalState } from "@tentacle-tv/tv-core";

export type { ArrivalState };

/**
 * L'ARRIVÉE d'un titre demandé par le compte, telle que les vues la dessinent :
 * l'affiche grisée qui reprend sa couleur au prorata de l'avancement, le
 * camembert au centre (`ArrivalArtwork`). Tout est résolu par le câblage —
 * sauf l'avancement À L'INSTANT : la vue le projette elle-même, une fois par
 * seconde (`useArrivalPercent`), tant qu'on la voit (`live`) et qu'un temps
 * restant accompagne la dernière lecture.
 *
 * États : ceux du contrat `titles.mine` (en attente, en route, mise en
 * bibliothèque, bloquée), plus `arrived` — un état du client : le titre vient
 * de sortir de la liste en avançant, il est dans la bibliothèque.
 */
export interface ArrivalModel {
  state: ArrivalState;
  /** La dernière lecture, 0 à 100 — en route seulement ; `null` sinon, ou s'il ne se sait pas. */
  percent: number | null;
  /** Le temps restant annoncé avec elle (s) ; `null` : immobile jusqu'à la lecture suivante. */
  etaSeconds: number | null;
  /** Quand l'appareil l'a reçue (ms). */
  at: number;
  /** On la voit, l'app au premier plan : l'avancement peut bouger seul entre deux lectures. */
  live: boolean;
}
