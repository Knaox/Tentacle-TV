import { useTranslation } from "react-i18next";

import { AdminSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Invitations » (admin) : génération et partage de codes
 * d'invitation (AdminSection, déplacée hors du hub profil).
 */
export function InvitesScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("invitations")}>
      <AdminSection />
    </SettingsScaffold>
  );
}
