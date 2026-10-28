/**
 * Octave (mobile) — la seconde moitié des Réglages d'Octave : les réglages de TENTACLE qui ont du sens dans la
 * musique, et ceux-là seulement (la règle du bureau) — la langue (le COMPTE), les profils (« Changer de profil »,
 * la même feuille que Tentacle, code PIN compris, d'où l'on gère aussi la famille) et « Au démarrage, ouvrir »
 * (CET appareil). Les MÊMES composants et la même source que Tentacle, jamais une copie.
 */

import { memo, useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { OctaveStartupChoice } from "@tentacle-tv/shared/octave/mode";
import { SettingsChoiceRow, SettingsRow, SettingsSection } from "@/components/settings";
import { LanguageChoiceRow } from "@/components/profile/LanguageChoiceRow";
import { openProfileSwitcher, useProfileSwitchOffered } from "@/profileSwitch/profileSwitchEntry";
import { spacing, typography, useThemedStyles, type AppTheme } from "@/theme";
import { octaveStartup } from "../octaveSettings";

export const SharedSettings = memo(function SharedSettings() {
  const { t } = useTranslation(["octaveShell", "music"]);
  const st = useThemedStyles(makeStyles);
  const switchOffered = useProfileSwitchOffered();
  const startup = octaveStartup.use();
  const options = useMemo<{ value: OctaveStartupChoice; label: string }[]>(
    () => [
      { value: "last", label: t("music:mode.startupLast") },
      { value: "octave", label: t("music:mode.startupOctave") },
      { value: "tentacle", label: t("music:mode.startupTentacle") },
    ],
    [t],
  );
  return (
    <>
      <Text style={st.title} accessibilityRole="header">{t("octaveShell:settings.shared")}</Text>
      <Text style={st.lead}>{t("octaveShell:settings.sharedLead")}</Text>
      <SettingsSection title={t("octaveShell:settings.language")} caption={t("octaveShell:settings.languageCaption")}>
        <LanguageChoiceRow label={t("octaveShell:settings.languageLabel")} scope="account" last />
      </SettingsSection>
      {switchOffered && (
        <SettingsSection title={t("octaveShell:settings.profiles")} caption={t("octaveShell:settings.profilesCaption")}>
          <SettingsRow
            icon="users"
            label={t("octaveShell:profile.switch")}
            description={t("octaveShell:settingsMobile.switchProfileHint")}
            scope="account"
            onPress={openProfileSwitcher}
            chevron
            last
          />
        </SettingsSection>
      )}
      <SettingsSection title={t("music:mode.startupTitle")} caption={t("music:mode.startupHint")}>
        <SettingsChoiceRow
          icon="power"
          label={t("music:mode.startupLabel")}
          options={options}
          value={startup}
          onChange={(value) => octaveStartup.set(value as OctaveStartupChoice)}
          scope="device"
          last
        />
      </SettingsSection>
    </>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    title: { ...typography.title, color: t.colors.text.primary, marginBottom: spacing.xs },
    lead: { ...typography.small, color: t.colors.text.tertiary, marginBottom: spacing.lg },
  });
