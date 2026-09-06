/**
 * La règle « Wi-Fi seulement », lisible d'un seul endroit : le runtime y
 * dépose les conditions du moment (réglage, réseau du téléphone, accusé
 * « continuer en données mobiles ») et la façade la consulte à la mise en
 * file — un titre gardé en données mobiles attend le Wi-Fi dès le départ, il
 * ne démarre pas pour être suspendu au prochain changement de réseau.
 */

import type { NetworkType } from "./connectivityStore";

interface Conditions {
  wifiOnly: boolean;
  networkType: NetworkType;
  cellularAck: boolean;
}

let conditions: Conditions = { wifiOnly: true, networkType: "unknown", cellularAck: false };

export function setTransferConditions(next: Conditions): void {
  conditions = next;
}

/** Les transferts peuvent-ils tourner sur le réseau actuel ? */
export function transfersAllowedNow(): boolean {
  return !(conditions.wifiOnly && conditions.networkType === "cellular" && !conditions.cellularAck);
}
