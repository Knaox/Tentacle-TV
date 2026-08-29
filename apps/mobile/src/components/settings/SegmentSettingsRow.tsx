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
  titre: string;
  aide: string;
  reglages: SegmentSettings;
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
export function SegmentSettingsRow({ titre, aide, reglages, onChange, last }: Props) {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const auto = reglages.action === "auto";

  return (
    <View style={[st.bloc, last && st.dernier]}>
      <Text style={st.titre}>{titre}</Text>
      <Text style={st.aide}>{aide}</Text>
      <SegmentedChoice
        accessibilityLabel={`${titre} — ${t("segmentActionLabel")}`}
        value={reglages.action}
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
        <View style={st.replis}>
          <View style={st.ligne}>
            <Text style={st.libelle}>{t("segmentCountdownTitle")}</Text>
            <Switch
              value={reglages.countdownVisible}
              onValueChange={(countdownVisible) => { onChange({ countdownVisible }); }}
              trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
              thumbColor={theme.colors.cta.brandFg}
              ios_backgroundColor={theme.colors.fill.medium}
              accessibilityLabel={t("segmentCountdownTitle")}
            />
          </View>
          <View style={st.ligne}>
            <Text style={st.libelle}>{t("segmentDelayLabel")}</Text>
            <TextInput
              value={String(reglages.autoDelayMs)}
              onChangeText={(texte) => {
                const saisi = Number.parseInt(texte, 10);
                // Un champ vidé ne vaut pas zéro : sans nombre, on n'écrit rien
                // — le délai tomberait à 0 entre deux frappes, et le passage
                // serait sauté sans rien demander.
                if (Number.isFinite(saisi)) {
                  onChange({ autoDelayMs: Math.min(saisi, SEGMENT_AUTO_DELAY_MAX_MS) });
                }
              }}
              keyboardType="number-pad"
              maxLength={5}
              style={st.champ}
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
    bloc: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
      gap: spacing.sm,
    },
    dernier: { borderBottomWidth: 0 },
    titre: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    aide: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 17 },
    replis: { gap: spacing.sm, paddingLeft: spacing.sm },
    ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    libelle: { ...typography.small, color: t.colors.text.secondary, flex: 1 },
    champ: {
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
