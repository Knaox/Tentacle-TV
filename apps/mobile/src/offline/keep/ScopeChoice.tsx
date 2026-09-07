import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/** Ce que la demande emporte : l'épisode appuyé, sa saison, ou toute la série. */
export type KeepScope = "episode" | "season" | "series";

const CHOICES: ReadonlyArray<{ value: KeepScope; key: string }> = [
  { value: "episode", key: "scopeEpisode" },
  { value: "season", key: "scopeSeason" },
  { value: "series", key: "scopeSeries" },
];

interface Props {
  value: KeepScope;
  onChange: (scope: KeepScope) => void;
  /** Le périmètre se charge : les autres restent lisibles, le geste attend. */
  busy?: boolean;
}

/**
 * Le choix du périmètre, en tête du dialogue. Il vit DANS la feuille et non
 * dans une seconde modale : deux modales à la fois coincent la pile native
 * (cf. `modalGate`), et le contenu du dialogue change déjà tout seul.
 */
export function ScopeChoice({ value, onChange, busy }: Props) {
  const { t } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  return (
    <View>
      <Text style={st.label}>{t("scopeLabel")}</Text>
      <View style={st.row}>
        {CHOICES.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              onPress={() => onChange(choice.value)}
              disabled={busy === true && !selected}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: busy === true && !selected }}
              style={[st.chip, selected && st.chipSelected]}
            >
              <Text style={[st.chipText, selected && st.chipTextSelected]}>{t(choice.key)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    row: { flexDirection: "row", gap: 8 },
    // 44 pt de haut : la cible tactile minimale, sans hitSlop à deviner.
    chip: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
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
