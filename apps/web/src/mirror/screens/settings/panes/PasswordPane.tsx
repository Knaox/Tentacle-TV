import { ChangePasswordSection } from "../../../../components/preferences/ChangePasswordSection";

/**
 * `PasswordPane` de l'app (`screens/settings/PasswordScreen.tsx`) : le
 * formulaire du web `ChangePasswordSection`, réutilisé tel quel (même appel
 * `POST /api/auth/change-password`, masqué pendant une impersonation).
 */
export function PasswordPane() {
  return <ChangePasswordSection />;
}
