/**
 * Octave (mobile) — le hub « Compte » (`/octave/account`), ouvert par l'avatar en tête des pages, à la manière
 * d'Apple Music : l'identité (photo, nom), le PROFIL (changer, code PIN, gérer la famille), OCTAVE (ses réglages,
 * la musique gardée hors ligne), l'APPARENCE d'Octave sur place, puis, à part, le retour à Tentacle TV.
 * Tablette : une colonne centrée, jamais un téléphone étiré.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { OctavePage, useOctaveLayout } from "../layout";
import { useLeaveOctave } from "../mode/useOctaveSwitch";
import { useOfflineSurface } from "../offline/musicOfflineContext";
import type { OctaveScreenProps } from "../registry/octaveRegistryTypes";
import { AppearanceRows } from "../settings/view/OctaveOnlySettings";
import { AccountIdentity } from "./AccountIdentity";
import { AccountProfileRows } from "./AccountProfileRows";

const MAX_WIDTH = 640;

export function OctaveAccountScreen(_props: OctaveScreenProps) {
  const { t } = useTranslation("octaveShell");
  const { gutter } = useOctaveLayout();
  return (
    <OctavePage title={t("account.title")} subtitle={t("settings.kicker")} back>
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <AccountIdentity />
        <AccountProfileRows />
        <OctaveRows />
        <SettingsSection title={t("account.appearanceGroup")} caption={t("appearance.caption")}>
          <AppearanceRows />
        </SettingsSection>
        <LeaveRow />
      </View>
    </OctavePage>
  );
}

const OctaveRows = memo(function OctaveRows() {
  const { t } = useTranslation("octaveShell");
  const router = useRouter();
  const offlineShown = useOfflineSurface().visible;
  const openSettings = () => router.push(octavePaths.settings as Href);
  const settingsRow = (last: boolean) => (
    <SettingsRow icon="sliders" label={t("settings.title")} description={t("account.settingsHint")} chevron last={last} onPress={openSettings} />
  );
  return (
    <SettingsSection title={t("account.octaveGroup")}>
      {settingsRow(!offlineShown)}
      {/* « Hors ligne » : la porte de la musique gardée (compte de l'appareil, droit `keepOffline`), jamais en session de profil. */}
      {offlineShown ? (
        <SettingsRow
          icon="download-cloud"
          label={t("account.offline")}
          description={t("account.offlineHint")}
          chevron
          last
          onPress={() => router.push(octavePaths.device as Href)}
        />
      ) : null}
    </SettingsSection>
  );
});

/** Le retour aux films et séries : à part, en dernier, comme une sortie (la barre ne le porte plus). */
const LeaveRow = memo(function LeaveRow() {
  const { t } = useTranslation("octaveShell");
  const leave = useLeaveOctave();
  return (
    <SettingsSection title={t("account.leaveGroup")}>
      <SettingsRow icon="film" label={t("account.leave")} description={t("account.leaveHint")} accent last onPress={leave} />
    </SettingsSection>
  );
});

const styles = StyleSheet.create({
  column: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", paddingBottom: 24 },
});
