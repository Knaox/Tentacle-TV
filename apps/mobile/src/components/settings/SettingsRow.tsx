import { type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import {
  spacing,
  typography,
  FONT_FAMILY,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

interface Props {
  /** Icône Feather à gauche. */
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  /** Sous-libellé optionnel sous le label. */
  description?: string;
  /** Valeur courante affichée à droite (ex. « Auto »). */
  value?: string;
  /** Contrôle personnalisé à droite (Switch, toggle...). Prioritaire sur value. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Affiche un chevron de navigation à droite (implique onPress). */
  chevron?: boolean;
  /** Teinte destructive (rouge) pour le label et l'icône. */
  destructive?: boolean;
  /** Retire la bordure basse (dernière ligne d'une carte). */
  last?: boolean;
  disabled?: boolean;
}

/**
 * Ligne de réglage générique : icône + label (+ description) à gauche, valeur
 * / contrôle / chevron à droite. Cible tactile >= 48pt, hairline de séparation
 * gérée par la carte parente (SettingsSection).
 */
export function SettingsRow({
  icon,
  label,
  description,
  value,
  trailing,
  onPress,
  chevron,
  destructive,
  last,
  disabled,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const tint = destructive ? theme.colors.status.error : theme.colors.text.primary;
  const interactive = !!onPress && !disabled;

  const content = (
    <View style={[st.row, !last && st.rowBordered, disabled && st.disabled]}>
      {icon ? (
        <Feather name={icon} size={19} color={destructive ? theme.colors.status.error : theme.colors.text.secondary} style={st.icon} />
      ) : null}
      <View style={st.labelWrap}>
        <Text style={[st.label, { color: tint }]} numberOfLines={1}>{label}</Text>
        {description ? <Text style={st.description}>{description}</Text> : null}
      </View>
      {trailing ?? (
        <View style={st.trailing}>
          {value ? <Text style={st.value} numberOfLines={1}>{value}</Text> : null}
          {chevron ? (
            <Feather name="chevron-right" size={18} color={theme.colors.text.quaternary} />
          ) : null}
        </View>
      )}
    </View>
  );

  if (!interactive) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => (pressed ? st.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm,
    },
    rowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    disabled: { opacity: 0.45 },
    pressed: { backgroundColor: t.colors.fill.subtle },
    icon: { width: 22, textAlign: "center" },
    labelWrap: { flex: 1, justifyContent: "center" },
    label: {
      ...typography.body,
      fontFamily: FONT_FAMILY.medium,
    },
    description: {
      ...typography.small,
      color: t.colors.text.tertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    trailing: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    value: {
      ...typography.body,
      color: t.colors.text.tertiary,
      maxWidth: 160,
    },
  });
