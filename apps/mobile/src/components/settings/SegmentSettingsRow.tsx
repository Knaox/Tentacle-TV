import { View, Text, Switch, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { SEGMENT_AUTO_DELAY_MAX_MS, type SegmentSettings } from "@tentacle-tv/shared";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";
import { SegmentedChoice } from "./SegmentedChoice";

interface Props {
  title: string;
  hint: string;
  settings: SegmentSettings;
  onChange: (patch: Partial<SegmentSettings>) => void;
  last?: boolean;
}

/**
 * Un passage d'épisode et ce que le lecteur en fait.
 *
 * Le décompte et son délai n'apparaissent QUE sous l'action automatique : un
 * bouton qu'on doit choisir n'a pas de minuteur, et en proposer le réglage
 * mentirait sur ce qui va se passer. Le délai est en millisecondes, comme
 * partout ailleurs — c'est l'unité du moteur, et un téléphone a un clavier.
 */
export function SegmentSettingsRow({ title, hint, settings, onChange, last }: Props) {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const auto = settings.action === "auto";

  return (
    <View style={[st.block, last && st.last]}>
      <Text style={st.title}>{title}</Text>
      <Text style={st.hint}>{hint}</Text>
      <SegmentedChoice
        accessibilityLabel={`${title} — ${t("segmentActionLabel")}`}
        value={settings.action}
        onChange={(action) => {
          if (action === "button" || action === "auto" || action === "off") onChange({ action });
        }}
        options={[
          { value: "button", label: t("segmentActionButton") },
          { value: "auto", label: t("segmentActionAuto") },
          { value: "off", label: t("segmentActionOff") },
        ]}
      />
      {auto && (
        <View style={st.nested}>
          <View style={st.row}>
            <Text style={st.label}>{t("segmentCountdownTitle")}</Text>
            <Switch
              value={settings.countdownVisible}
              onValueChange={(countdownVisible) => { onChange({ countdownVisible }); }}
              trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
              thumbColor={theme.colors.cta.brandFg}
              ios_backgroundColor={theme.colors.fill.medium}
              accessibilityLabel={t("segmentCountdownTitle")}
            />
          </View>
          <View style={st.row}>
            <Text style={st.label}>{t("segmentDelayLabel")}</Text>
            <TextInput
              value={String(settings.autoDelayMs)}
              onChangeText={(text) => {
                const entered = Number.parseInt(text, 10);
                // Un champ vidé ne vaut pas zéro : sans nombre, on n'écrit rien
                // — le délai tomberait à 0 entre deux frappes, et le passage
                // serait sauté sans rien demander.
                if (Number.isFinite(entered)) {
                  onChange({ autoDelayMs: Math.min(entered, SEGMENT_AUTO_DELAY_MAX_MS) });
                }
              }}
              keyboardType="number-pad"
              maxLength={5}
              style={st.field}
              accessibilityLabel={t("segmentDelayLabel")}
            />
          </View>
        </View>
      )}
    </View>
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
    nested: { gap: spacing.sm, paddingLeft: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    label: { ...typography.small, color: t.colors.text.secondary, flex: 1 },
    field: {
      minWidth: 88,
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
