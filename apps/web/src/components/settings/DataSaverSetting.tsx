import { useTranslation } from "react-i18next";
import { GaugeIcon as Gauge } from "@phosphor-icons/react/dist/csr/Gauge";
import { WifiHighIcon as Wifi } from "@phosphor-icons/react/dist/csr/WifiHigh";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";

import { useDataSaverActive, useDataSaverSetting } from "../../offline/useDataSaver";
import type { DataSaverSetting as DataSaverChoice } from "../../offline/dataSaver";
import { ChoiceTiles, type ChoiceTile } from "./ChoiceTiles";
import { SettingItem } from "./wide/SettingItem";

const ICON = 18;

/**
 * Économie de données — dans Réglages › Lecture › Connexion (elle avait sa
 * rubrique d'une seule ligne, « Données », où personne ne la cherchait :
 * elle règle ce que la LECTURE et l'accueil consomment).
 *
 * Réglage PAR APPAREIL (localStorage), comme le thème : la qualité de
 * connexion dépend de l'endroit où tourne l'app, pas du compte. Le même
 * utilisateur peut être en fibre au bureau et en partage de connexion ailleurs.
 *
 * `auto` par défaut : la latence mesurée par les sondes de connectivité décide.
 * Les deux forçages existent pour les cas que la mesure ne peut pas connaître —
 * un lien rapide mais facturé au volume, ou au contraire lent mais illimité.
 */
export function DataSaverSetting() {
  const { t } = useTranslation("downloads");
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();

  const modes: ChoiceTile<DataSaverChoice>[] = [
    { id: "auto", label: t("saverModeAuto"), icon: <Gauge size={ICON} />, hint: t("saverModeAutoHint") },
    { id: "on", label: t("saverModeOn"), icon: <WifiOff size={ICON} />, hint: t("saverModeOnHint") },
    { id: "off", label: t("saverModeOff"), icon: <Wifi size={ICON} />, hint: t("saverModeOffHint") },
  ];

  return (
    <SettingItem setting="dataSaver" note={active ? `${t("saverSettingsCaption")} — ${t("saverActiveNow")}` : t("saverSettingsCaption")}>
      <ChoiceTiles label={t("saverSettingsTitle")} value={setting} options={modes} onChange={setSetting} />
    </SettingItem>
  );
}
