import { ConnectivityBinding } from "./ConnectivityBinding";
import { DataSaverBinding } from "./DataSaverBinding";
import { OfflineEventsBinding } from "./OfflineEventsBinding";
import { OfflineOverlays } from "./OfflineOverlays";
import { OfflineRouteGuard } from "./OfflineRouteGuard";
import { OfflineRuntimeSync } from "./OfflineRuntimeSync";

/**
 * Point de montage UNIQUE du hors ligne dans `app/_layout.tsx`, sous
 * AppProviders : le branchement du magasin de connectivité, du mode économie
 * et du moteur hors ligne, la garde de route et les voiles. Tout ce que le hors ligne ajoutera à la coquille passe par ici.
 */
export function OfflineShell() {
  return (
    <>
      <ConnectivityBinding />
      <DataSaverBinding />
      <OfflineRuntimeSync />
      <OfflineEventsBinding />
      <OfflineRouteGuard />
      <OfflineOverlays />
    </>
  );
}
