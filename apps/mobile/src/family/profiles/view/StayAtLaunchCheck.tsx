import { Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface StayAtLaunchCheckProps {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/**
 * « Ne plus proposer au démarrage » sous les profils de « Qui regarde ? » à
 * l'ouverture : cochée, l'appareil ouvrira directement le profil choisi
 * (règle partagée `familyMobileLaunch.ts`). Toute la ligne est la cible
 * (44 pt au moins), annoncée comme une case à cocher.
 */
export function StayAtLaunchCheck({ checked, disabled, onToggle }: StayAtLaunchCheckProps) {
  const { t } = useTranslation("familyMobile");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityHint={t("launch.stayHint")}
      style={({ pressed }) => [st.row, pressed && st.pressed, disabled && st.disabled]}
    >
      <Feather name={checked ? "check-square" : "square"} size={22} color={checked ? theme.colors.brand.light : theme.colors.text.secondary} />
      <Text style={st.label}>{t("launch.stay")}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      marginTop: spacing.xl,
    },
    pressed: { backgroundColor: t.colors.fill.subtle },
    disabled: { opacity: 0.5 },
    label: { ...typography.body, color: t.colors.text.primary },
  });
