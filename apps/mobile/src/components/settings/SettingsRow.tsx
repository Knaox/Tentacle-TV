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

export type SettingsIcon = keyof typeof Feather.glyphMap;

interface Props {
  /** Icône Feather à gauche. */
  icon?: SettingsIcon;
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
  /**
   * Option d'une liste à choix unique : coche à droite quand vrai, rôle
   * « radio » dès que la prop est posée (vraie ou fausse).
   */
  checked?: boolean;
  /** Ligne ouverte dans le volet de détail (tablette) : fond et icône teintés. */
  selected?: boolean;
  /** Teinte destructive (rouge) pour le label et l'icône. */
  destructive?: boolean;
  /** Teinte de marque pour une action positive (« Créer une invitation »). */
  accent?: boolean;
  /** Retire la bordure basse (dernière ligne d'une carte). */
  last?: boolean;
  disabled?: boolean;
  /** Libellé accessible, quand le label seul ne suffit pas. */
  accessibilityLabel?: string;
}

/**
 * Ligne de réglage générique : icône + label (+ description) à gauche, valeur
 * / contrôle / chevron / coche à droite. Cible tactile >= 52 pt, hairline de
 * séparation gérée ici (sauf `last`).
 */
export function SettingsRow({
  icon,
  label,
  description,
  value,
  trailing,
  onPress,
  chevron,
  checked,
  selected,
  destructive,
  accent,
  last,
  disabled,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { colors } = theme;
  const tint = destructive ? colors.status.error : accent ? colors.brand.light : colors.text.primary;
  const iconTint = destructive
    ? colors.status.error
    : accent || selected || checked ? colors.brand.violet : colors.text.secondary;
  const interactive = !!onPress && !disabled;
  const isOption = checked !== undefined;

  const content = (
    <View style={[st.row, !last && st.rowBordered, selected && st.selected, disabled && st.disabled]}>
      {icon ? <Feather name={icon} size={19} color={iconTint} style={st.icon} /> : null}
      <View style={st.labelWrap}>
        <Text style={[st.label, { color: tint }]} numberOfLines={2}>{label}</Text>
        {description ? <Text style={st.description}>{description}</Text> : null}
      </View>
      {trailing ?? (
        <View style={st.trailing}>
          {value ? <Text style={st.value} numberOfLines={1}>{value}</Text> : null}
          {isOption ? (
            <Feather name="check" size={18} color={checked ? colors.brand.violet : "transparent"} />
          ) : null}
          {chevron ? <Feather name="chevron-right" size={18} color={colors.text.quaternary} /> : null}
        </View>
      )}
    </View>
  );

  if (!interactive) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={isOption ? "radio" : "button"}
      accessibilityState={isOption ? { checked, selected: checked } : selected ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
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
    selected: { backgroundColor: t.colors.brand.soft },
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
