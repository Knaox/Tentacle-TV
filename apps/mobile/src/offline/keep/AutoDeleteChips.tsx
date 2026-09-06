import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/** `null` = pas d'auto-suppression ; sinon délai en minutes après visionnage. */
export type AutoDeleteValue = number | null;

const CHOICES: ReadonlyArray<{ value: AutoDeleteValue; key: string }> = [
  { value: null, key: "autoDeleteOff" },
  { value: 0, key: "autoDeleteImmediate" },
  { value: 60, key: "autoDeleteDelay1h" },
  { value: 360, key: "autoDeleteDelay6h" },
  { value: 720, key: "autoDeleteDelay12h" },
  { value: 1440, key: "autoDeleteDelay24h" },
];

interface Props {
  value: AutoDeleteValue;
  onChange: (value: AutoDeleteValue) => void;
  /** Sans le titre « Supprimer après visionnage » (feuille d'actions de la gestion). */
  compact?: boolean;
}

/** Les six puces « supprimer après visionnage » — les mêmes valeurs que le bureau. */
export function AutoDeleteChips({ value, onChange, compact }: Props) {
  const { t } = useTranslation("downloads");
  const st = useThemedStyles(makeStyles);
  return (
    <View>
      {!compact && <Text style={st.label}>{t("autoDeleteAfterWatch")}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
        {CHOICES.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={String(choice.value)}
              onPress={() => onChange(choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[st.chip, selected && st.chipSelected]}
            >
              <Text style={[st.chipText, selected && st.chipTextSelected]}>{t(choice.key)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
    row: { gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    chipSelected: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.16, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow),
    },
    chipText: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    chipTextSelected: { color: t.colors.text.primary, fontFamily: FONT_FAMILY.semibold },
  });
