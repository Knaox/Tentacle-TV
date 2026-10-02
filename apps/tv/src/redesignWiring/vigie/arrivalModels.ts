import type { MyTitle } from "@tentacle-tv/shared";
import type { ArrivalModel } from "../../redesign/requests/arrivalTypes";

/**
 * D'un titre attendu (contrat `titles.mine`) à son ARRIVÉE telle que les vues
 * la dessinent — l'affiche grise qui se colore, le camembert au centre. Pur :
 * l'app et le banc passent par ici.
 */

/** La lecture d'où partent les vues : quand l'appareil l'a reçue, et si on la voit. */
export interface ArrivalReading {
  /** L'heure de la lecture (ms) — `dataUpdatedAt` de la liste. */
  at: number;
  /** Visible, l'app au premier plan : l'avancement bouge seul entre deux lectures. */
  live: boolean;
}

/** Une lecture figée (le banc, une image) : rien ne bouge seul. */
export const STILL_READING: ArrivalReading = { at: 0, live: false };

export function arrivalOf(title: MyTitle, reading: ArrivalReading): ArrivalModel {
  return { state: title.state, percent: title.percent, etaSeconds: title.etaSeconds, at: reading.at, live: reading.live };
}

/** Un titre ARRIVÉ (sorti de la liste en avançant) : pleine couleur, le camembert qui s'efface. */
export function arrivedModel(reading: ArrivalReading): ArrivalModel {
  return { state: "arrived", percent: null, etaSeconds: null, at: reading.at, live: reading.live };
}

/** Le mot d'un titre arrivé (espace `requests`). */
export const ARRIVED_LABEL_KEY = "requests:stateArrived";
