/**
 * La règle « Wi-Fi seulement », lisible d'un seul endroit et TOUJOURS à jour :
 * le réglage (base locale), le réseau du téléphone (magasin de connectivité)
 * et l'accusé « continuer en données mobiles » (réglage d'appareil). La façade
 * la consulte à la mise en file — un titre gardé en données mobiles attend le
 * Wi-Fi dès le départ, il ne démarre pas pour être suspendu au prochain
 * changement de réseau.
 */

import { getConnectivitySnapshot } from "./connectivityStore";
import { isCellularAcked } from "./deviceSettings";
import { isWifiOnly } from "./settings";

/** Les transferts peuvent-ils tourner sur le réseau actuel ? */
export function transfersAllowedNow(): boolean {
  if (!isWifiOnly()) return true;
  if (getConnectivitySnapshot().networkType !== "cellular") return true;
  return isCellularAcked();
}
