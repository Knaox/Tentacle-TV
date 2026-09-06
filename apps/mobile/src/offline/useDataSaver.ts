import { useCallback, useSyncExternalStore } from "react";
import { isDataSaverActive, subscribeDataSaver } from "@tentacle-tv/api-client";
import {
  getDataSaverSetting,
  setDataSaverSetting,
  subscribeDataSaverSetting,
  type DataSaverSetting,
} from "./dataSaverStore";

/**
 * Accès React au mode économie. Deux hooks distincts :
 *  - `useDataSaverSetting` — le RÉGLAGE (auto/on/off), pour la page Données ;
 *  - `useDataSaverActive` — la DÉCISION effective, pour ce qui doit s'adapter
 *    (la pastille « Économie »).
 */
export function useDataSaverSetting(): { setting: DataSaverSetting; setSetting: (next: DataSaverSetting) => void } {
  const setting = useSyncExternalStore(subscribeDataSaverSetting, getDataSaverSetting, getDataSaverSetting);
  const setSetting = useCallback((next: DataSaverSetting) => setDataSaverSetting(next), []);
  return { setting, setSetting };
}

/** Mode économie effectivement appliqué aux requêtes (réglage ∘ connectivité). */
export function useDataSaverActive(): boolean {
  return useSyncExternalStore(subscribeDataSaver, isDataSaverActive, isDataSaverActive);
}
