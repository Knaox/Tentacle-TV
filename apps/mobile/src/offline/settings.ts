/**
 * Les réglages du hors ligne qui vivent DANS la base locale (table
 * `settings` du cœur) — et non dans le stockage de l'application : ils
 * survivent à « Vider le cache », comme les titres eux-mêmes.
 *
 * « Wi-Fi seulement » (défaut : activé) est le seul réglage à réagir dans
 * l'interface ; les caches de préférences de pistes passent par les accès
 * génériques, synchrones, par compte.
 */

import { useSyncExternalStore } from "react";
import { settingGet, settingSet } from "@tentacle-tv/offline-core";
import { localDb } from "./database";

const WIFI_ONLY_KEY = "wifi_only";

let wifiOnly: boolean | null = null;
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

/** Les transferts attendent-ils le Wi-Fi ? Lu une fois, puis en mémoire. */
export function isWifiOnly(): boolean {
  if (wifiOnly === null) wifiOnly = (offlineSettingGet(WIFI_ONLY_KEY) ?? "1") === "1";
  return wifiOnly;
}

export function setWifiOnly(on: boolean): void {
  if (wifiOnly === on) return;
  offlineSettingSet(WIFI_ONLY_KEY, on ? "1" : "0");
  wifiOnly = on;
  notify();
}

export function subscribeOfflineSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWifiOnly(): boolean {
  return useSyncExternalStore(subscribeOfflineSettings, isWifiOnly, isWifiOnly);
}
