import { setLiveTransfers, useLiveTransfers } from "@/offline/deviceSettings";
import { liveTransfersSupported } from "@/offline/live/liveSurface";

/**
 * Ce que les réglages lisent du SUIVI EN DIRECT des transferts hors ligne —
 * l'ADAPTATEUR vers le magasin de la session « hors-ligne-live » (lot du
 * 2026-10-20), BRANCHÉ : `useLiveTransfers()` / `setLiveTransfers(on)` dans
 * `offline/deviceSettings.ts` (clé `tentacle_offline_live_activity`, allumé
 * par défaut). La ligne ne paraît que si l'appareil sait montrer un transfert
 * en direct (`liveTransfersSupported`).
 */

export interface LiveTransfersSetting {
  /** L'appareil sait montrer un transfert en direct, et la fonction est dans ce binaire. */
  available: boolean;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

export function useLiveTransfersSetting(): LiveTransfersSetting {
  const enabled = useLiveTransfers();
  // Synchrone, sans React : Android (build récent) ; iOS 16.2+ avec les Activités en direct
  // permises ; faux sur iPad, iOS < 16.2 ou un ancien binaire → la ligne ne paraît pas.
  return { available: liveTransfersSupported(), enabled, setEnabled: setLiveTransfers };
}
