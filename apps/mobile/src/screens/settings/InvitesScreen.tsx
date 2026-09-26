import { useTranslation } from "react-i18next";

import { InvitesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Invitations » (admin) : créer un code d'invitation, partager
 * ceux qui sont encore valables.
 */
export function InvitesScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("invitations")}>
      <InvitesPane />
    </SettingsScaffold>
  );
}

export function InvitesPane() {
  return <InvitesSection />;
}
