import { useTranslation } from "react-i18next";

import { PairTvSection } from "@/components/pair/PairTvSection";
import { PairedDevicesSection } from "@/components/profile";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * « Appareils et TV » : le jumelage d'une TV EN TÊTE — les cases du code
 * tout de suite, sans écran de plus —, puis la liste des appareils jumelés
 * et leur révocation. Plein écran sur téléphone, colonne de détail sur
 * tablette (`DevicesPane`).
 */
export function DevicesScreen() {
  const { t } = useTranslation("profile");
  return (
    <SettingsScaffold title={t("devicesAndTv")}>
      <DevicesPane />
    </SettingsScaffold>
  );
}

export function DevicesPane() {
  return (
    <>
      <PairTvSection />
      <PairedDevicesSection />
    </>
  );
}
