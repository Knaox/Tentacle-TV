/**
 * Les réglages du hors ligne qui vivent DANS la base locale (table
 * `settings` du cœur) — et non dans le stockage de l'application : ils
 * survivent à « Vider le cache », comme les titres eux-mêmes.
 *
 * Deux réglages y réagissent dans l'interface : « Wi-Fi seulement » (défaut :
 * activé) et « Continuer en arrière-plan » (défaut : activé). Les caches de
 * préférences de pistes passent par les accès génériques, synchrones, par
 * compte.
 */

import { useSyncExternalStore } from "react";
import { settingGet, settingSet } from "@tentacle-tv/offline-core";
import { localDb } from "./database";

const WIFI_ONLY_KEY = "wifi_only";
const BACKGROUND_TRANSFERS_KEY = "background_transfers";

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export function offlineSettingGet(key: string): string | null {
  return settingGet(localDb(), key);
}

export function offlineSettingSet(key: string, value: string): void {
  settingSet(localDb(), key, value);
}

/** Un réglage oui / non : lu une fois dans la base, puis tenu en mémoire. */
function booleanSetting(key: string, defaultOn: boolean): { get: () => boolean; set: (on: boolean) => void } {
  let value: boolean | null = null;
  return {
    get: () => {
      if (value === null) value = (offlineSettingGet(key) ?? (defaultOn ? "1" : "0")) === "1";
      return value;
    },
    set: (on) => {
      if (value === on) return;
      offlineSettingSet(key, on ? "1" : "0");
      value = on;
      notify();
    },
  };
}

const wifiOnly = booleanSetting(WIFI_ONLY_KEY, true);
const backgroundTransfers = booleanSetting(BACKGROUND_TRANSFERS_KEY, true);

/** Les transferts attendent-ils le Wi-Fi ? */
export const isWifiOnly = wifiOnly.get;
export const setWifiOnly = wifiOnly.set;

/** Les transferts continuent-ils l'application derrière ou l'écran éteint ? */
export const isBackgroundTransfers = backgroundTransfers.get;
export const setBackgroundTransfers = backgroundTransfers.set;

export function subscribeOfflineSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWifiOnly(): boolean {
  return useSyncExternalStore(subscribeOfflineSettings, isWifiOnly, isWifiOnly);
}

export function useBackgroundTransfers(): boolean {
  return useSyncExternalStore(subscribeOfflineSettings, isBackgroundTransfers, isBackgroundTransfers);
}
