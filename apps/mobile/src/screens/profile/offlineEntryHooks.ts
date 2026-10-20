/**
 * Ce que les réglages lisent du SUIVI EN DIRECT des transferts hors ligne —
 * l'ADAPTATEUR vers le magasin de la session « hors-ligne-live » (lot du
 * 2026-10-20) : `useLiveTransfers()` / `setLiveTransfers(on)` dans
 * `offline/deviceSettings.ts` (clé `tentacle_offline_live_activity`, allumé
 * par défaut). Tant qu'il n'est pas fusionné, ce module répond
 * « indisponible » : la ligne ne paraît pas — jamais une erreur.
 */

export interface LiveTransfersSetting {
  /** L'appareil sait montrer un transfert en direct, et la fonction est dans ce binaire. */
  available: boolean;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

const UNAVAILABLE: LiveTransfersSetting = { available: false, enabled: false, setEnabled: () => undefined };

export function useLiveTransfersSetting(): LiveTransfersSetting {
  return UNAVAILABLE;
}
