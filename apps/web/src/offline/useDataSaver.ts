/**
 * Accès React au mode économie. Deux hooks distincts :
 *  - `useDataSaverSetting` — le RÉGLAGE (auto/on/off), pour l'écran de réglages ;
 *  - `useDataSaverActive` — la DÉCISION effective, pour les composants qui
 *    doivent s'adapter (gel de la rotation du hero, indicateur de la pastille).
 *
 * `useSyncExternalStore` plutôt qu'un Context : l'état change hors de tout
 * rendu React (sondes réseau), même choix que `useConnectivity`.
 */

import { useCallback, useSyncExternalStore } from "react";
import { isDataSaverActive, subscribeDataSaver } from "@tentacle-tv/api-client";
import {
  getDataSaverSetting,
  setDataSaverSetting,
  subscribeDataSaverSetting,
  type DataSaverSetting,
} from "./dataSaver";

export interface DataSaverSettingValue {
  setting: DataSaverSetting;
  setSetting: (next: DataSaverSetting) => void;
}

export function useDataSaverSetting(): DataSaverSettingValue {
  const setting = useSyncExternalStore(
    subscribeDataSaverSetting,
    getDataSaverSetting,
    getDataSaverSetting,
  );
  const setSetting = useCallback((next: DataSaverSetting) => {
    setDataSaverSetting(next);
  }, []);
  return { setting, setSetting };
}

/** Mode économie effectivement appliqué aux requêtes (réglage ∘ lien mesuré). */
export function useDataSaverActive(): boolean {
  return useSyncExternalStore(subscribeDataSaver, isDataSaverActive, isDataSaverActive);
}
