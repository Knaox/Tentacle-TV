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

import { useMemo } from "react";
import type { DownloadStatus } from "@tentacle-tv/offline-core";
import { getConnectivitySnapshot, isOfflineMode, type NetworkType } from "./connectivityStore";
import { isCellularAcked, useCellularAck } from "./deviceSettings";
import { isWifiOnly, useWifiOnly } from "./settings";
import { useConnectivity } from "./useConnectivity";

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

/** Pourquoi une entrée n'avance pas : le Wi-Fi, le réseau — ou rien de tel. */
export type TransferWait = "wifi" | "network" | null;

export interface TransferWaitContext extends WifiGateContext {
  offline: boolean;
}

/**
 * Ce qu'une ligne parquée attend. Parquée = en file, ou en pause SYSTÈME (une
 * pause explicite n'attend rien : elle lit « En pause »). Un seul prédicat pour
 * le badge, la carte d'attente et l'indice du dialogue.
 */
export function transferWait(
  entry: { status: DownloadStatus; pausedByUser: boolean },
  ctx: TransferWaitContext,
): TransferWait {
  const parked = entry.status === "queued" || (entry.status === "paused" && !entry.pausedByUser);
  if (!parked) return null;
  if (wifiBlocked(ctx)) return "wifi";
  if (ctx.offline) return "network";
  return null;
}

/** Le contexte vivant du prédicat, pour les écrans. */
export function useTransferWaitContext(): TransferWaitContext {
  const wifiOnly = useWifiOnly();
  const cellularAck = useCellularAck();
  const { networkType, state } = useConnectivity();
  const offline = state === "offline-auto" || state === "offline-manual";
  return useMemo(() => ({ wifiOnly, networkType, cellularAck, offline }), [wifiOnly, networkType, cellularAck, offline]);
}
