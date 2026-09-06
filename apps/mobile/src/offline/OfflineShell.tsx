import { ConnectivityBinding } from "./ConnectivityBinding";
import { DataSaverBinding } from "./DataSaverBinding";
import { OfflineOverlays } from "./OfflineOverlays";
import { OfflineRouteGuard } from "./OfflineRouteGuard";

/**
 * Point de montage UNIQUE du hors ligne dans `app/_layout.tsx`, sous
 * AppProviders : le branchement du magasin de connectivité et du mode
 * économie, la garde de route et les voiles. Tout ce que le hors ligne ajoutera à la coquille passe par ici.
 */
export function OfflineShell() {
  return (
    <>
      <ConnectivityBinding />
      <DataSaverBinding />
      <OfflineRouteGuard />
      <OfflineOverlays />
    </>
  );
}
