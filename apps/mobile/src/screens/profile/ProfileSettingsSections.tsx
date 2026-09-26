import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LanguageChoiceRow } from "@/components/profile/LanguageChoiceRow";
import { AdminSessionsRow } from "@/components/profile/AdminSessionsRow";
import { LiquidGlassRow, SettingsRow, SettingsSection, ThemeChoiceRow } from "@/components/settings";
import { FadeIn } from "@/components/ui";
import { useOfflineActivity } from "@/hooks/offline/useOfflineList";
import { useDataSaverSetting } from "@/offline/useDataSaver";
import { DATA_SAVER_LABEL_KEYS } from "@/screens/settings/DataSettingsScreen";
import { ProfilePaneRow } from "./ProfilePaneRow";
import type { PaneContext } from "./profilePanes";

/**
 * Les sections de RÉGLAGES du profil (1 à 5 de l'organisation décrite dans
 * `profilePanes.ts`) : Préférences, Apparence, Sur cet appareil, Appareils,
 * Administration. Les choix courts (thème, langue) se font sur place ; le
 * reste ouvre un volet ou un écran.
 */
export function ProfileSettingsSections({ ctx }: { ctx: PaneContext }) {
  const { t } = useTranslation("profile");
  const { t: tp } = useTranslation("preferences");
  const { t: td } = useTranslation("downloads");
  const router = useRouter();
  const { setting: saver } = useDataSaverSetting();
  const { offline, isAdmin, offlineVisible } = ctx;

  return (
    <>
      <FadeIn delay={60}>
        <SettingsSection title={t("preferences")}>
          {!offline && (
            <ProfilePaneRow pane="personalization" icon="sliders" label={tp("sectionPersonalization")} description={t("personalizationHint")} />
          )}
          <ProfilePaneRow pane="playback" icon="play-circle" label={t("playback")} />
          {!offline && <ProfilePaneRow pane="notifications" icon="bell" label={t("notifications")} />}
          {/* L'économie de données est un réglage local : elle vaut aussi hors ligne. */}
          <ProfilePaneRow pane="data" icon="bar-chart-2" label={tp("sectionData")} value={td(DATA_SAVER_LABEL_KEYS[saver])} last />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={120}>
        <SettingsSection title={t("appearance")}>
          <ThemeChoiceRow />
          <LanguageChoiceRow />
          <LiquidGlassRow />
        </SettingsSection>
      </FadeIn>

      {offlineVisible && (
        <FadeIn delay={180}>
          <OnDeviceRows />
        </FadeIn>
      )}

      {!offline && (
        <FadeIn delay={220}>
          <SettingsSection title={t("sectionDevices")}>
            <SettingsRow icon="cast" label={t("pairTV")} chevron onPress={() => router.push("/pair-tv")} />
            <ProfilePaneRow pane="devices" icon="smartphone" label={t("pairedDevices")} last />
          </SettingsSection>
        </FadeIn>
      )}

      {isAdmin && !offline && (
        <FadeIn delay={260}>
          <SettingsSection title={t("administration")}>
            <AdminSessionsRow />
            <ProfilePaneRow pane="invites" icon="mail" label={t("invitations")} last />
          </SettingsSection>
        </FadeIn>
      )}
    </>
  );
}

/**
 * Section « Sur cet appareil » : « 12 titres · 1 en cours » vers l'écran de
 * gestion, et les réglages hors ligne en volet.
 */
function OnDeviceRows() {
  const { t: to } = useTranslation("offline");
  const router = useRouter();
  const { active, total } = useOfflineActivity();
  const parts = [to("countTitles", { count: total })];
  if (active > 0) parts.push(to("countActive", { count: active }));
  return (
    <SettingsSection title={to("sectionOnDevice")}>
      <SettingsRow icon="smartphone" label={to("myOfflineTitles")} description={parts.join(" · ")} chevron onPress={() => router.push("/on-device")} />
      <ProfilePaneRow pane="onDevice" icon="settings" label={to("profileRowSettings")} last />
    </SettingsSection>
  );
}
