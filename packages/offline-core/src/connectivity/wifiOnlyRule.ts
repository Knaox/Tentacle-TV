/**
 * « Wi-Fi seulement » : quel réseau croire, et quand relever les transferts
 * mis de côté. Règles PURES, testées (recette Android du 21/10, D3 : un titre
 * restait « En attente » à 0 % en plein Wi-Fi).
 *
 * Deux défauts y menaient :
 * - sur Android, expo-network relit le type AVANT que le Wi-Fi devienne le
 *   réseau par défaut, et plus jamais ensuite : il restait « cellulaire ». Le
 *   réseau par défaut suivi par le module natif l'emporte donc, quand il sait ;
 * - la reprise exigeait un serveur DÉJÀ sondé joignable : le Wi-Fi reconnu
 *   avant la première sonde laissait la ligne de côté jusqu'à l'évènement
 *   suivant. Un serveur injoignable n'a pas besoin de cette garde — le moteur
 *   remet de côté ce qu'il ne peut pas lancer (`canTransfer`).
 */

import type { NetworkType } from "./networkLink";

/** Le réseau par défaut suivi par le natif (Android), sinon celui d'expo-network. « Inconnu » ne l'emporte jamais. */
export function preferDefaultNetwork(defaultNetwork: NetworkType | null, reported: NetworkType): NetworkType {
  return defaultNetwork === null || defaultNetwork === "unknown" ? reported : defaultNetwork;
}

export interface WifiOnlyContext {
  wifiOnly: boolean;
  networkType: NetworkType;
  /** « Continuer en données mobiles » accepté pour cette session. */
  cellularAck: boolean;
  /** Le serveur, selon la dernière sonde : `null` tant qu'aucune n'a répondu. */
  reachable: boolean | null | undefined;
}

/**
 * Ce que le réseau du moment impose aux transferts : tout mettre de côté
 * (données mobiles sous « Wi-Fi seulement »), relever ce qui attendait, ou rien
 * (serveur su injoignable : le retour du serveur relèvera).
 */
export function wifiOnlyAction(ctx: WifiOnlyContext): "suspend" | "resume" | "none" {
  if (ctx.wifiOnly && ctx.networkType === "cellular" && !ctx.cellularAck) return "suspend";
  return ctx.reachable === false ? "none" : "resume";
}
