import { useTranslation } from "react-i18next";

import { PairedDevicesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Appareils appairés » : liste des TV/appareils appairés et
 * révocation (PairedDevicesSection, déplacée hors du hub profil).
 */
export function DevicesScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("pairedDevices")}>
      <PairedDevicesSection />
    </SettingsScaffold>
  );
}
