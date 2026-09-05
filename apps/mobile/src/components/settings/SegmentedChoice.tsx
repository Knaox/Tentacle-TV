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
  /** Quatre options sur un téléphone : deux par rangée, sinon un mot se coupe. */
  wrap?: boolean;
}

/**
 * Un choix parmi deux ou trois, en boutons côte à côte.
 *
 * Un `Switch` ne sait dire que oui ou non, et une liste modale pour trois
 * valeurs coûte deux gestes là où il en faut un. La forme est celle des
 * réglages de lecture — action d'un passage, déclencheur de la suite.
 */
export function SegmentedChoice({ options, value, onChange, accessibilityLabel, wrap }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.row, wrap && st.rowWrap]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { onChange(option.value); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              st.button,
              wrap && st.buttonWrap,
              isActive && st.buttonActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            {/* Deux lignes, pas une : « Faire tout seul » ou « Personnalisé »
                se faisaient tronquer par une ellipse — un libellé de choix
                doit se lire en entier. */}
            <Text style={[st.label, isActive && st.labelActive]} numberOfLines={2}>
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
    rowWrap: { flexWrap: "wrap" },
    buttonWrap: { flex: 0, flexGrow: 1, flexBasis: "46%" },
    button: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    buttonActive: {
      borderColor: t.colors.brand.violet,
      backgroundColor: t.colors.brand.soft,
    },
    label: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
      textAlign: "center",
    },
    labelActive: { color: t.colors.text.primary },
  });
