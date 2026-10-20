import { ChangePasswordSection } from "../../components/preferences/ChangePasswordSection";
import { MyDevicesSection } from "../../components/settings/MyDevicesSection";
import { ChangeServerSection } from "../../components/settings/ChangeServerSection";
import { Navigate } from "react-router-dom";
import { isDesktopApp } from "../../desktop/bridge";
import { useActiveProfile } from "../../auth/profileSession";
import { useSecurityAbilities } from "../../rights/useSecurityAbilities";

/**
 * Sécurité — regroupe ce qui était dispersé sur quatre écrans.
 *
 * Avant : le mot de passe et les appareils jumelés étaient enterrés tout en bas
 * de `/settings`, sous une carte de préférences PAR bibliothèque — donc après
 * un défilement proportionnel au nombre de bibliothèques de l'utilisateur. Le
 * changement de serveur était au même endroit, l'appairage TV sur
 * `/pair-device`.
 *
 * Non couvert, et à ne pas laisser croire : sessions actives, 2FA/TOTP et
 * suppression de compte n'existent NULLE PART dans le monorepo, ni au front ni
 * au backend. Les ajouter est un chantier serveur distinct.
 */
export function SettingsSecurity() {
  // Session d'un profil : rien de tout cela n'est à lui (le serveur le refuse).
  const profile = useActiveProfile();
  // Ce que le serveur dit des droits de la session (`account.abilities`).
  const { password, devices, any, pending } = useSecurityAbilities();
  if (profile || (!any && !pending)) return <Navigate to="/settings/appearance" replace />;
  return (
    <div className="max-w-2xl">
      {password && <ChangePasswordSection />}
      {devices && <MyDevicesSection />}
      {isDesktopApp() && <ChangeServerSection />}
    </div>
  );
}
