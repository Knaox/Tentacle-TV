/**
 * Le verdict d'une installation par le Store, sans koffi : la règle se teste
 * hors de Windows.
 *
 * `StorePackageUpdateState` (`windows.services.store.h`, SDK 10.0.26100) :
 * Pending 0, Downloading 1, Deploying 2, **Completed 3**, Canceled 4,
 * OtherError 5, ErrorLowBattery 6, ErrorWiFiRecommended 7, ErrorWiFiRequired 8.
 *
 * ⚠️ Le succès vaut 3, pas 0. Cette constante a longtemps valu 0 : une mise à
 * jour RÉUSSIE était traitée en échec (page du Store ouverte, pas de
 * redémarrage), et un état `Pending` serait passé pour un succès.
 * `apps/server-windows/src/update/updateTypes.ts` lit la même énumération.
 */

/** `StorePackageUpdateState::Completed`. */
export const STATE_COMPLETED = 3;

/**
 * Codes levés quand l'utilisateur peut agir lui-même : refus dans le dialogue,
 * batterie faible, Wi-Fi exigé. Ouvrir la page du Store n'y changerait rien —
 * et après un refus, ce serait passer outre.
 */
const USER_ACTIONABLE_CODES: ReadonlySet<string> = new Set([
  "install-canceled",
  "install-low-battery",
  "install-wifi-required",
]);

/**
 * Le code d'erreur d'un état final, ou `null` si l'installation a abouti.
 * Tout état inconnu ou intermédiaire (Pending, Downloading, Deploying) est un
 * échec : `GetResults` a rendu la main sans que rien ne soit installé.
 */
export function msixInstallError(state: number | null): string | null {
  switch (state) {
    case STATE_COMPLETED:
      return null;
    case 4:
      return "install-canceled";
    case 6:
      return "install-low-battery";
    case 7:
    case 8:
      return "install-wifi-required";
    default:
      return `install-state-${String(state)}`;
  }
}

/** La page de mises à jour du Store est-elle un repli utile pour ce code ? */
export function opensStorePage(code: string): boolean {
  return !USER_ACTIONABLE_CODES.has(code);
}
