import { useTranslation } from "react-i18next";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useDataSaverActive, useDataSaverSetting } from "../../../../offline/useDataSaver";
import type { DataSaverSetting } from "../../../../offline/dataSaver";
import { SettingsOptionList, type SettingsOption } from "../ui/SettingsOptionList";
import { SettingsSection } from "../ui/SettingsSection";

const MODES = [
  { id: "auto", icon: Activity, label: "saverModeAuto", hint: "saverModeAutoHint" },
  { id: "on", icon: WifiOff, label: "saverModeOn", hint: "saverModeOnHint" },
  { id: "off", icon: Wifi, label: "saverModeOff", hint: "saverModeOffHint" },
] as const;

/** Les libellés courts du mode, pour la valeur affichée sur la ligne du profil. */
export const DATA_SAVER_LABEL_KEYS: Record<DataSaverSetting, string> = {
  auto: "saverModeAuto",
  on: "saverModeOn",
  off: "saverModeOff",
};

/**
 * `DataPane` de l'app (`screens/settings/DataSettingsScreen.tsx`) : le mode
 * économie, réglage PAR APPAREIL, en lignes à coche. Même magasin que la page
 * web `SettingsData` (`offline/useDataSaver`).
 */
export function DataPane() {
  const { t } = useTranslation("downloads");
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();
  const caption = active ? `${t("saverSettingsCaption")} — ${t("saverActiveNow")}` : t("saverSettingsCaption");
  const options: SettingsOption<DataSaverSetting>[] = MODES.map((mode) => ({
    value: mode.id, icon: mode.icon, label: t(mode.label), description: t(mode.hint),
  }));

  return (
    <SettingsSection title={t("saverSettingsTitle")} caption={caption}>
      <SettingsOptionList options={options} value={setting} onChange={setSetting} />
    </SettingsSection>
  );
}
