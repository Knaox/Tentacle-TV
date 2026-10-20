import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";
import { IN_BROWSER } from "../pickerPlatform";
import { useAskAtLaunch } from "./useAskAtLaunch";

/**
 * Réglages › Famille, sur le BUREAU et dans le NAVIGATEUR : « Demander qui
 * regarde à l'ouverture » (`useAskAtLaunch`), jumeau de la case « Ne plus
 * proposer à la prochaine ouverture » de « Qui regarde ? ». Un autre
 * ordinateur du compte garde le sien. Coupé par l'administration : la ligne
 * le dit, sans interrupteur.
 *
 * Absente face à un serveur sans la capacité de cette coquille (`pickerPlatform.ts`),
 * sans famille d'au moins deux profils, et pendant la session d'un profil (la
 * page de la Famille n'y existe pas).
 */
export function AskAtLaunchSection() {
  const { t } = useTranslation("profilePicker");
  const setting = useAskAtLaunch();
  if (!setting) return null;
  return (
    <SettingsSection title={t("launchSetting.title")} caption={IN_BROWSER ? t("launchSetting.captionWeb") : t("launchSetting.caption")}>
      <SettingsRow
        icon={<MonitorPlay size={17} />}
        label={IN_BROWSER ? t("launchSetting.sectionWeb") : t("launchSetting.section")}
        description={setting.description}
        trailing={setting.allowed ? <ToggleSwitch checked={setting.proposes} onChange={setting.toggle} label={t("launchSetting.title")} /> : undefined}
        last
      />
    </SettingsSection>
  );
}
