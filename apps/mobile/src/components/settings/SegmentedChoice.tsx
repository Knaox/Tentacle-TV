import { View, Text, Pressable, StyleSheet } from "react-native";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

export interface ChoiceOption {
  value: string;
  label: string;
}

interface Props {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  /** Libellé accessible du groupe — les boutons n'en portent pas de contexte. */
  accessibilityLabel: string;
}

/**
 * Un choix parmi deux ou trois, en boutons côte à côte.
 *
 * Un `Switch` ne sait dire que oui ou non, et une liste modale pour trois
 * valeurs coûte deux gestes là où il en faut un. La forme est celle des
 * réglages de lecture — action d'un passage, déclencheur de la suite.
 */
export function SegmentedChoice({ options, value, onChange, accessibilityLabel }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const actif = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { onChange(option.value); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            style={({ pressed }) => [
              st.bouton,
              actif && st.boutonActif,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[st.libelle, actif && st.libelleActif]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.xs },
    bouton: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    boutonActif: {
      borderColor: t.colors.brand.violet,
      backgroundColor: t.colors.brand.soft,
    },
    libelle: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      textAlign: "center",
    },
    libelleActif: { color: t.colors.text.primary },
  });
