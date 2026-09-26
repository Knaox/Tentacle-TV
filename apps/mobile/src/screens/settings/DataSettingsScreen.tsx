import { useTranslation } from "react-i18next";
import { SettingsSection, SettingsOptionList, type SettingsOption } from "@/components/settings";
import { SettingsScaffold } from "@/screens/settings/SettingsScaffold";
import { useDataSaverActive, useDataSaverSetting } from "@/offline/useDataSaver";
import type { DataSaverSetting } from "@/offline/dataSaverStore";

const MODES: ReadonlyArray<{ id: DataSaverSetting; icon: SettingsOption["icon"]; label: string; hint: string }> = [
  { id: "auto", icon: "activity", label: "saverModeAuto", hint: "saverModeAutoHint" },
  { id: "on", icon: "wifi-off", label: "saverModeOn", hint: "saverModeOnHint" },
  { id: "off", icon: "wifi", label: "saverModeOff", hint: "saverModeOffHint" },
];

/** Les libellés courts du mode, pour la valeur affichée sur la ligne du profil. */
export const DATA_SAVER_LABEL_KEYS: Record<DataSaverSetting, string> = {
  auto: "saverModeAuto",
  on: "saverModeOn",
  off: "saverModeOff",
};

/**
 * Données — le mode économie. Réglage PAR APPAREIL, comme le thème : la
 * qualité de connexion dépend de l'endroit où tourne l'application, pas du
 * compte. `auto` par défaut : la latence mesurée par les sondes et le réseau
 * du téléphone décident ; les deux forçages couvrent ce que la mesure ne peut
 * pas savoir (lien rapide mais facturé au volume, ou lent mais illimité).
 */
export function DataSettingsScreen() {
  const { t } = useTranslation("offline");
  return (
    <SettingsScaffold title={t("dataTitle")}>
      <DataPane />
    </SettingsScaffold>
  );
}

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
