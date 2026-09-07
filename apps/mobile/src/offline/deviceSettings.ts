/**
 * Les réglages D'APPAREIL du hors ligne qui vivent dans le stockage de
 * l'application (mêmes clés que le web, listées dans `STORAGE_KEYS`) — donc
 * remis à zéro par « Vider le cache », contrairement à « Wi-Fi seulement »
 * et aux caches de langues, qui vivent dans la base locale :
 *
 * - `tentacle_offline_notify_ready` : la notification « Prêt hors ligne »
 *   (activée par défaut) ;
 * - « Continuer en données mobiles » : en MÉMOIRE seulement — vaut jusqu'au
 *   prochain retour du Wi-Fi ou au prochain lancement. Il survivait à un arrêt
 *   forcé : relancée en cellulaire, l'application transférait sans accord
 *   frais ni carte visible. L'ancienne clé de stockage est effacée.
 *
 * Amorcé par `configureDeviceSettings(storage)` ; sans effet au chargement.
 */

import { useSyncExternalStore } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";

const NOTIFY_READY_KEY = "tentacle_offline_notify_ready";
const CELLULAR_ACK_KEY = "tentacle_offline_cellular_ack";

let storage: StorageAdapter | null = null;
let notifyReady = true;
let cellularAck = false;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export function configureDeviceSettings(adapter: StorageAdapter): void {
  storage = adapter;
  // Trace des versions qui persistaient l'accusé : effacée, jamais relue.
  if (adapter.getItem(CELLULAR_ACK_KEY) !== null) adapter.removeItem(CELLULAR_ACK_KEY);
  const nextNotify = adapter.getItem(NOTIFY_READY_KEY) !== "0";
  if (nextNotify === notifyReady) return;
  notifyReady = nextNotify;
  notify();
}

export const isNotifyReady = (): boolean => notifyReady;

export function setNotifyReady(on: boolean): void {
  if (notifyReady === on) return;
  notifyReady = on;
  if (on) storage?.removeItem(NOTIFY_READY_KEY);
  else storage?.setItem(NOTIFY_READY_KEY, "0");
  notify();
}

export const isCellularAcked = (): boolean => cellularAck;

export function setCellularAck(on: boolean): void {
  if (cellularAck === on) return;
  cellularAck = on;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotifyReady(): boolean {
  return useSyncExternalStore(subscribe, isNotifyReady, isNotifyReady);
}

export function useCellularAck(): boolean {
  return useSyncExternalStore(subscribe, isCellularAcked, isCellularAcked);
}
