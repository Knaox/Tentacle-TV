import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, Cast, ChartNoAxesColumn, CirclePlay, Mail, SlidersHorizontal, Smartphone } from "lucide-react";
import { useDataSaverSetting } from "../../../offline/useDataSaver";
import { DATA_SAVER_LABEL_KEYS } from "../settings/panes/DataPane";
import { SettingsRow } from "../settings/ui/SettingsRow";
import { SettingsSection } from "../settings/ui/SettingsSection";
import type { PaneContext } from "../settings/panes";
import { AdminSessionsRow } from "./AdminSessionsRow";
import { LanguageChoiceRow, ThemeChoiceRow } from "./AppearanceRows";
import { ProfilePaneRow } from "./ProfilePaneRow";

/**
 * `ProfileSettingsSections` de l'app : Mes statistiques (en tête, sans titre
 * de section), Préférences, Apparence, Appareils, Administration. Les choix courts (thème, langue) se font sur place ; le
 * reste ouvre un volet ou un écran. Absents du web : Notifications (push
 * natif), Liquid Glass (iOS 26), Sur cet appareil (navigateur).
 */
export function ProfileSettingsSections({ ctx }: { ctx: PaneContext }) {
  const { t } = useTranslation("profile");
  const { t: tp } = useTranslation("preferences");
  const { t: td } = useTranslation("downloads");
  const navigate = useNavigate();
  const { setting: saver } = useDataSaverSetting();
  const { offline, isAdmin } = ctx;

  return (
    <>
      {!offline && (
        <SettingsSection>
          <SettingsRow icon={BarChart3} label={t("stats")} description={t("statsHint")} accent chevron onPress={() => navigate("/stats")} last />
        </SettingsSection>
      )}

      <SettingsSection title={t("preferences")}>
        {!offline && (
          <ProfilePaneRow pane="personalization" icon={SlidersHorizontal} label={tp("sectionPersonalization")} description={t("personalizationHint")} />
        )}
        <ProfilePaneRow pane="playback" icon={CirclePlay} label={t("playback")} />
        {/* L'économie de données est un réglage local : elle vaut aussi hors ligne. */}
        <ProfilePaneRow pane="data" icon={ChartNoAxesColumn} label={tp("sectionData")} value={td(DATA_SAVER_LABEL_KEYS[saver])} last />
      </SettingsSection>

      <SettingsSection title={t("appearance")}>
        <ThemeChoiceRow />
        <LanguageChoiceRow last />
      </SettingsSection>

      {!offline && (
        <SettingsSection title={t("sectionDevices")}>
          <SettingsRow icon={Cast} label={t("pairTV")} chevron onPress={() => navigate("/pair-device")} />
          <ProfilePaneRow pane="devices" icon={Smartphone} label={t("pairedDevices")} last />
        </SettingsSection>
      )}

      {isAdmin && !offline && (
        <SettingsSection title={t("administration")}>
          <AdminSessionsRow />
          <ProfilePaneRow pane="invites" icon={Mail} label={t("invitations")} last />
        </SettingsSection>
      )}
    </>
  );
}
