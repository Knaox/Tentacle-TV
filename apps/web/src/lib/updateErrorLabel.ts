/**
 * Codes d'erreur de la coquille → clé i18n, ou message brut en dernier recours.
 *
 * La coquille lève des codes techniques (`store-page-opened`,
 * `install-canceled`…) et la modale les affichait TELS QUELS : l'utilisateur
 * lisait « Error: store-page-opened » dans sa langue de personne.
 *
 * ⚠️ Electron préfixe tout rejet d'`invoke` de « Error invoking remote method
 * 'tentacle:…': Error: ». Sans le retirer, AUCUN code n'était reconnu sur le
 * bureau : le préfixe partait à l'écran avec lui.
 */
export function updateErrorLabel(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = raw
    .replace(/^Error invoking remote method '[^']+':\s*/, "")
    .replace(/^Error:\s*/, "");
  return UPDATE_ERROR_KEYS[code] ?? (UPDATE_ERROR_KEYS[code.replace(/-\d+$/, "-*")] ?? code);
}

/**
 * Codes connus. La modale traduit ce qui commence par `notifications:`.
 * Ceux de l'installation viennent de `msixInstallState.ts` (coquille Electron).
 */
const UPDATE_ERROR_KEYS: Record<string, string> = {
  "store-page-opened": "notifications:updateStorePageOpened",
  "store-unavailable": "notifications:updateStoreUnavailable",
  "no-update": "notifications:updateNoLongerAvailable",
  "iterable-unavailable": "notifications:updateStoreUnavailable",
  "install-refused": "notifications:updateInstallRefused",
  "install-failed": "notifications:updateInstallRefused",
  "install-state-*": "notifications:updateInstallRefused",
  "install-canceled": "notifications:updateInstallCanceled",
  "install-low-battery": "notifications:updateLowBattery",
  "install-wifi-required": "notifications:updateWifiRequired",
  "aucune fenetre pour la boite de dialogue du Store": "notifications:updateStoreUnavailable",
};
