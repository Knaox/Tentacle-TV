import { ConnectivityBinding } from "./ConnectivityBinding";
import { OfflineOverlays } from "./OfflineOverlays";

/**
 * Point de montage UNIQUE du hors ligne dans `app/_layout.tsx`, sous
 * AppProviders : le branchement du magasin de connectivité et les voiles.
 * Tout ce que le hors ligne ajoutera à la coquille passe par ici.
 */
export function OfflineShell() {
  return (
    <>
      <ConnectivityBinding />
      <OfflineOverlays />
    </>
  );
}
