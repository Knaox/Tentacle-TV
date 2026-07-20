/**
 * Pont réglage + connectivité → `api-client`.
 *
 * Seul endroit qui décide si le mode économie est actif. Les couches réseau
 * (hubs de la home, URLs d'images, reporting de lecture) lisent ensuite cette
 * décision à l'exécution, sans jamais connaître la connectivité.
 *
 * Monté à côté de `ConnectivityBinding`, au-dessus des routes : la décision
 * doit exister avant que le moindre `queryFn` ne s'exécute.
 */

import { useEffect } from "react";
import { setDataSaverActive } from "@tentacle-tv/api-client";
import { useConnectivity } from "./useConnectivity";
import { resolveDataSaver } from "./dataSaver";
import { useDataSaverSetting } from "./useDataSaver";

export function DataSaverBinding() {
  const { linkQuality } = useConnectivity();
  const { setting } = useDataSaverSetting();

  useEffect(() => {
    setDataSaverActive(resolveDataSaver(setting, linkQuality === "slow"));
  }, [setting, linkQuality]);

  return null;
}
