/**
 * Les mots de la mise à jour Store, sans koffi : la règle (`updateCoordinator`)
 * se teste sans Windows.
 */

export interface StoreUpdateInfo {
  available: boolean;
  mandatory: boolean;
  /** Windows permet le téléchargement et l'installation sans dialogue (« Mettre à jour automatiquement », réseau non limité). */
  canSilent: boolean;
}

export type InstallOutcome = "completed" | "canceled" | "failed" | "unavailable" | "low-battery" | "wifi-required";

/**
 * `StorePackageUpdateState` (`windows.services.store.h`) : Pending 0,
 * Downloading 1, Deploying 2, **Completed 3**, Canceled 4, OtherError 5,
 * ErrorLowBattery 6, ErrorWiFiRecommended 7, ErrorWiFiRequired 8.
 */
export function installOutcome(state: number | null): InstallOutcome {
  switch (state) {
    case 3:
      return "completed";
    case 4:
      return "canceled";
    case 6:
      return "low-battery";
    case 7:
    case 8:
      return "wifi-required";
    default:
      return "failed";
  }
}
