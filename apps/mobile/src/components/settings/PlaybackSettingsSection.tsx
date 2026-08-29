import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset, presetSettings } from "@tentacle-tv/shared";

import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsSection } from "./SettingsSection";

/**
 * Ce que le lecteur a le droit de faire tout seul, sur téléphone : UN choix.
 *
 * Le téléphone montrait les mêmes vingt contrôles que l'ordinateur — dont un
 * délai en millisecondes et deux champs nombre, à saisir au pouce. Le réglage
 * fin n'a pas sa place ici : il se fait sur grand écran, il suit le COMPTE, et
 * il s'applique donc à cet appareil sans qu'on ait à le répéter.
 *
 * Reste le mode, qui est la seule question courante. « Personnalisé »
 * n'est pas proposé : c'est ce qu'on lit quand les réglages viennent de
 * l'ordinateur, et le toucher les remplacerait.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const st = useThemedStyles(makeStyles);
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  const preset = detectPreset(settings);

  const options = [
    { value: "manual", label: t("playbackModeManual") },
    { value: "automatic", label: t("playbackModeAutomatic") },
    ...(preset === "custom" ? [{ value: "custom", label: t("playbackModeCustom") }] : []),
  ];

  return (
    <SettingsSection title={t("playbackModeTitle")} caption={t("playbackSettingsAccount")}>
      <View style={st.block}>
        <Text style={st.title}>{t("playbackModeLabel")}</Text>
        <SegmentedChoice
          accessibilityLabel={t("playbackModeLabel")}
          value={preset}
          options={options}
          onChange={(value) => {
            if (value === "manual" || value === "automatic") {
              setPlaybackSettings(presetSettings(value));
            }
          }}
        />
        <Text style={st.hint}>
          {t(
            preset === "manual"
              ? "playbackModeManualHint"
              : preset === "automatic"
                ? "playbackModeAutomaticHint"
                : "playbackModeCustomHint",
          )}
        </Text>
      </View>
      <View style={[st.block, st.last]}>
        <Text style={st.hint}>{t("playbackAdvancedOnDesktop")}</Text>
      </View>
    </SettingsSection>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    block: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
      gap: spacing.sm,
    },
    last: { borderBottomWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 17 },
  });
