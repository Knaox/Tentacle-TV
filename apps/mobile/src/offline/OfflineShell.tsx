import { ConnectivityBinding } from "./ConnectivityBinding";
import { DataSaverBinding } from "./DataSaverBinding";
import { OfflineEventsBinding } from "./OfflineEventsBinding";
import { OfflineReadyNotifier } from "./OfflineReadyNotifier";
import { OfflineLiveActivity } from "./live/OfflineLiveActivity";
import { KeepOfflineHost } from "./keep/KeepOfflineHost";
import { OfflineOverlays } from "./OfflineOverlays";
import { OfflineRouteGuard } from "./OfflineRouteGuard";
import { OfflineSessionGate } from "./OfflineSessionGate";
import { OfflineRuntimeSync } from "./OfflineRuntimeSync";
import { OfflineRightsSync } from "./rights/OfflineRightsSync";
import { OfflineAccountFallback } from "./rights/OfflineAccountFallback";
import { useOfflineProfileSession } from "./rights/useOfflineOwner";
import { useAccountUserId } from "@/family/profiles/profileSessionState";

/**
 * Point de montage UNIQUE du hors ligne dans `app/_layout.tsx`, sous
 * AppProviders : le branchement du magasin de connectivité, du mode économie
 * et du moteur hors ligne, la garde de route et les voiles. Tout ce que le hors ligne ajoutera à la coquille passe par ici.
 */
export function OfflineShell() {
  // Le hors ligne est au compte de l'appareil : son suivi en direct et ses annonces aussi, muets
  // pendant une session de profil (le lot du compte continue en coulisse).
  const ownerUserId = useAccountUserId();
  const hidden = useOfflineProfileSession();
  return (
    <>
      <ConnectivityBinding />
      <OfflineAccountFallback />
      <DataSaverBinding />
      <OfflineRuntimeSync />
      <OfflineRightsSync />
      <OfflineEventsBinding />
      <OfflineReadyNotifier ownerUserId={ownerUserId} hidden={hidden} />
      <OfflineLiveActivity ownerUserId={ownerUserId} hidden={hidden} />
      <KeepOfflineHost />
      <OfflineRouteGuard />
      <OfflineOverlays />
      <OfflineSessionGate />
    </>
  );
}
