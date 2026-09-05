import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { moveRow } from "@tentacle-tv/api-client";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  rows: HomeRowDescriptor[];
  labelFor: (key: string) => string;
  onChange: (rows: HomeRowDescriptor[]) => void;
  /** Tant que les bibliothèques ne sont pas connues : rien ne bouge. */
  disabled?: boolean;
}

/**
 * L'ordre et l'activation des rangées de l'accueil : flèches ↑/↓ (44 pt) et
 * interrupteur — jamais de glisser-déposer, qui ne vaut ni au doigt ni aux
 * lecteurs d'écran. L'interrupteur masque une rangée sans la supprimer.
 */
export function HomeRowsEditor({ rows, labelFor, onChange, disabled }: Props) {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <View style={st.list} accessibilityRole="list">
      {rows.map((row, index) => {
        const label = labelFor(row.key);
        const upDisabled = disabled || index === 0;
        const downDisabled = disabled || index === rows.length - 1;
        return (
          <View key={row.key} style={st.row}>
            <Text style={[st.label, !row.enabled && st.labelOff]} numberOfLines={1}>{label}</Text>
            <MoveButton
              icon="chevron-up"
              label={`${t("persoRowMoveUp")} : ${label}`}
              disabled={upDisabled}
              onPress={() => onChange(moveRow(rows, index, index - 1))}
            />
            <MoveButton
              icon="chevron-down"
              label={`${t("persoRowMoveDown")} : ${label}`}
              disabled={downDisabled}
              onPress={() => onChange(moveRow(rows, index, index + 1))}
            />
            <Switch
              value={row.enabled}
              disabled={disabled}
              onValueChange={(enabled) => onChange(rows.map((r) => (r.key === row.key ? { ...r, enabled } : r)))}
              trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
              thumbColor={theme.colors.cta.brandFg}
              ios_backgroundColor={theme.colors.fill.medium}
              accessibilityLabel={label}
            />
          </View>
        );
      })}
    </View>
  );
}

function MoveButton({ icon, label, disabled, onPress }: {
  icon: "chevron-up" | "chevron-down";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [st.move, disabled && st.moveOff, pressed && !disabled && st.pressed]}
    >
      <Feather name={icon} size={20} color={theme.colors.text.secondary} />
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  list: { gap: 6 },
  row: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    paddingLeft: spacing.md, paddingRight: spacing.sm, minHeight: 52,
    borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.subtle, backgroundColor: t.colors.fill.faint,
  },
  label: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flex: 1, marginRight: spacing.xs },
  labelOff: { color: t.colors.text.tertiary },
  // 44 × 44 : la cible tactile entière, l'icône au centre.
  move: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center" as const, justifyContent: "center" as const },
  moveOff: { opacity: 0.3 },
  pressed: { backgroundColor: t.colors.fill.subtle },
});
