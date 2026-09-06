import { useEffect } from "react";
import { setDataSaverActive, useTentacleConfig } from "@tentacle-tv/api-client";
import { configureDataSaver, resolveDataSaver } from "./dataSaverStore";
import { useConnectivity } from "./useConnectivity";
import { useDataSaverSetting } from "./useDataSaver";

/**
 * Pont réglage + connectivité → `api-client`. Seul endroit qui décide si le
 * mode économie est actif ; les couches réseau (hubs de l'accueil, URLs
 * d'images, rapport de lecture) lisent la décision à l'exécution. Ne rend rien.
 */
export function DataSaverBinding() {
  const { storage } = useTentacleConfig();
  const { linkQuality, networkType } = useConnectivity();
  const { setting } = useDataSaverSetting();

  useEffect(() => {
    configureDataSaver(storage);
  }, [storage]);

  useEffect(() => {
    setDataSaverActive(resolveDataSaver(setting, linkQuality === "slow", networkType === "cellular"));
  }, [setting, linkQuality, networkType]);

  return null;
}
