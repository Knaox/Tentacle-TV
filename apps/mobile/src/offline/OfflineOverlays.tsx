import { OfflineBanner } from "@/components/OfflineBanner";
import { useConnectivity } from "./useConnectivity";
import { useHasLocalContent } from "./useOfflineMode";
import { useOfflineVeilActions } from "./useOfflineVeilActions";

/**
 * Le voile plein écran du hors ligne : serveur injoignable CONFIRMÉ par
 * l'hystérésis, et rien à montrer à la place (aucun titre sur l'appareil,
 * pas de mode manuel). Nécessite AppProviders.
 */
export function OfflineOverlays() {
  const { state } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  const { isChecking, retry, handleLogout, handleChangeServer } = useOfflineVeilActions();

  return (
    <OfflineBanner
      visible={state === "offline-auto" && !hasLocalContent}
      isChecking={isChecking}
      onRetry={retry}
      onLogout={handleLogout}
      onChangeServer={handleChangeServer}
    />
  );
}
