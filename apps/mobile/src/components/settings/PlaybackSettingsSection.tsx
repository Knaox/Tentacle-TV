import { View, Text, Switch, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import {
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  type SegmentSettings,
} from "@tentacle-tv/shared";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsSection } from "./SettingsSection";

/**
 * Ce que le lecteur a le droit de faire tout seul, sur téléphone.
 *
 * Mêmes réglages que sur le web et le téléviseur, et surtout le même MAGASIN :
 * ils suivent le compte, pas l'appareil. Le délai posé ici vaut devant la
 * télévision, où l'on ne saisit pas de nombre à la télécommande.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const settings = usePlaybackSettings();
  const next = settings.next;

  // Dans l'ordre où les passages surviennent à l'écran.
  const segments: {
    key: string;
    title: string;
    hint: string;
    state: SegmentSettings;
    apply: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    { key: "intro", title: t("segmentIntroTitle"), hint: t("segmentIntroHint"), state: settings.intro,
      apply: (intro) => { setPlaybackSettings({ intro }); } },
    { key: "recap", title: t("segmentRecapTitle"), hint: t("segmentRecapHint"), state: settings.recap,
      apply: (recap) => { setPlaybackSettings({ recap }); } },
    { key: "outro", title: t("segmentOutroTitle"), hint: t("segmentOutroHint"), state: settings.outro,
      apply: (outro) => { setPlaybackSettings({ outro }); } },
    { key: "preview", title: t("segmentPreviewTitle"), hint: t("segmentPreviewHint"), state: settings.preview,
      apply: (preview) => { setPlaybackSettings({ preview }); } },
  ];

  const toggles: { key: string; title: string; hint: string; active: boolean; set: (v: boolean) => void }[] = [
    { key: "card", title: t("upNextCardTitle"), hint: t("upNextCardHint"), active: next.nextCard,
      set: (nextCard) => { setPlaybackSettings({ next: { nextCard } }); } },
    { key: "countdown", title: t("upNextCountdownTitle"), hint: t("upNextCountdownHint"), active: next.nextCountdown,
      set: (nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); } },
    { key: "auto", title: t("upNextAutoPlayTitle"), hint: t("upNextAutoPlayHint"), active: next.nextAutoPlay,
      set: (nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); } },
  ];

  return (
    <>
      <SettingsSection
        title={t("playbackSegmentsTitle")}
        caption={`${t("playbackSegmentsHint")}\n${t("playbackSettingsAccount")}`}
      >
        {segments.map((segment, index) => (
          <SegmentSettingsRow
            key={segment.key}
            title={segment.title}
            hint={segment.hint}
            settings={segment.state}
            onChange={segment.apply}
            last={index === segments.length - 1}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={t("upNextTitle")}>
        {toggles.map((toggle) => (
          <View key={toggle.key} style={st.block}>
            <View style={st.row}>
              <View style={st.text}>
                <Text style={st.title}>{toggle.title}</Text>
                <Text style={st.hint}>{toggle.hint}</Text>
              </View>
              <Switch
                value={toggle.active}
                onValueChange={toggle.set}
                trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
                thumbColor={theme.colors.cta.brandFg}
                ios_backgroundColor={theme.colors.fill.medium}
                accessibilityLabel={toggle.title}
              />
            </View>
          </View>
        ))}
        <View style={st.block}>
          <Text style={st.title}>{t("upNextTriggerLabel")}</Text>
          <SegmentedChoice
            accessibilityLabel={t("upNextTriggerLabel")}
            value={next.nextTrigger}
            onChange={(nextTrigger) => {
              if (nextTrigger === "outroStart" || nextTrigger === "beforeEnd") {
                setPlaybackSettings({ next: { nextTrigger } });
              }
            }}
            options={[
              { value: "outroStart", label: t("upNextTriggerOutroStart") },
              { value: "beforeEnd", label: t("upNextTriggerBeforeEnd") },
            ]}
          />
        </View>
        <View style={[st.block, st.last]}>
          <View style={st.row}>
            <View style={st.text}>
              <Text style={st.title}>{t("upNextBeforeEndLabel")}</Text>
              <Text style={st.hint}>{t("upNextBeforeEndHint")}</Text>
            </View>
            <TextInput
              value={String(next.nextBeforeEndSeconds)}
              onChangeText={(text) => {
                const entered = Number.parseInt(text, 10);
                if (!Number.isFinite(entered)) return;
                const clamped = Math.min(
                  NEXT_BEFORE_END_SECONDS_MAX,
                  Math.max(NEXT_BEFORE_END_SECONDS_MIN, entered),
                );
                setPlaybackSettings({ next: { nextBeforeEndSeconds: clamped } });
              }}
              keyboardType="number-pad"
              maxLength={3}
              style={st.field}
              accessibilityLabel={t("upNextBeforeEndLabel")}
            />
          </View>
        </View>
      </SettingsSection>
    </>
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
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    text: { flex: 1 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 17, marginTop: 2 },
    field: {
      minWidth: 72,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
      color: t.colors.text.primary,
      textAlign: "right",
      ...typography.body,
    },
  });
