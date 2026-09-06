/**
 * La règle « Wi-Fi seulement », lisible d'un seul endroit et TOUJOURS à jour :
 * le réglage (base locale), le réseau du téléphone (magasin de connectivité)
 * et l'accusé « continuer en données mobiles » (mémoire de session).
 *
 * Le moteur la consulte à chaque `pump` (`canStartTransfers`) : mise en file,
 * reprise explicite, démarrage, retour au premier plan — un titre gardé en
 * données mobiles attend le Wi-Fi dès le départ, une reprise appuyée en
 * cellulaire aussi, et rien ne part sur un réseau pas encore identifié.
 */

import { getConnectivitySnapshot, isOfflineMode, type NetworkType } from "./connectivityStore";
import { isCellularAcked } from "./deviceSettings";
import { isWifiOnly } from "./settings";

export interface WifiGateContext {
  wifiOnly: boolean;
  networkType: NetworkType;
  cellularAck: boolean;
}

/** « Wi-Fi seulement » coupe-t-il ? Données mobiles, sans accusé « continuer ». */
export function wifiBlocked(ctx: WifiGateContext): boolean {
  return ctx.wifiOnly && ctx.networkType === "cellular" && !ctx.cellularAck;
}

function liveContext(): WifiGateContext {
  return { wifiOnly: isWifiOnly(), networkType: getConnectivitySnapshot().networkType, cellularAck: isCellularAcked() };
}

/**
 * Peut-on LANCER un transfert sur le réseau actuel ? Comme `wifiBlocked`,
 * plus : un réseau pas encore identifié (`unknown`, le temps qu'expo-network
 * réponde) ne lance rien — on ne coupe pas pour autant ce qui tourne déjà.
 */
export function transfersAllowedNow(): boolean {
  const ctx = liveContext();
  if (!ctx.wifiOnly) return true;
  if (ctx.networkType === "unknown") return false;
  return !wifiBlocked(ctx);
}

/** La politique du moteur (`EngineDeps.canTransfer`) : réseau autorisé ET serveur tenu pour joignable. */
export function canStartTransfers(): boolean {
  return transfersAllowedNow() && !isOfflineMode();
}
