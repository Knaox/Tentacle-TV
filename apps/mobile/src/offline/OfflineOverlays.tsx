import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineSwitchBanner } from "./OfflineSwitchBanner";
import { useConnectivity } from "./useConnectivity";
import { useHasLocalContent } from "./useOfflineMode";
import { useOfflineVeilActions } from "./useOfflineVeilActions";

/**
 * Ce que l'application montre quand elle bascule hors ligne.
 *
 * Deux cas, exclusifs par construction : sans titre sur l'appareil, le voile
 * plein écran (il n'y a rien d'autre à faire) ; avec des titres, un bandeau
 * qui explique la bascule au-dessus du catalogue local. Nécessite AppProviders.
 */
export function OfflineOverlays() {
  const { state } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  const { isChecking, retry, handleLogout, handleChangeServer } = useOfflineVeilActions();

  return (
    <>
      <OfflineBanner
        visible={state === "offline-auto" && hasLocalContent === false}
        isChecking={isChecking}
        onRetry={retry}
        onLogout={handleLogout}
        onChangeServer={handleChangeServer}
      />
      <OfflineSwitchBanner />
    </>
  );
}
