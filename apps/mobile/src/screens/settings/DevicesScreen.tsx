import { useTranslation } from "react-i18next";

import { PairedDevicesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Sous-écran « Appareils appairés » : jumeler une TV, puis la liste des
 * appareils jumelés et leur révocation.
 */
export function DevicesScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("pairedDevices")}>
      <DevicesPane />
    </SettingsScaffold>
  );
}

export function DevicesPane() {
  return <PairedDevicesSection />;
}
