/**
 * Octave mobile — une ligne d'action de feuille : icône, libellé, 52 pt de
 * haut (cible généreuse au pouce), retour visuel à l'appui.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { typography, useTheme } from "@/theme";
import { accentTextOf } from "../ui/pageStyle";

interface SheetActionProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** L'icône pleine (le cœur d'un titre aimé). */
  filled?: boolean;
  /** `danger` : un geste destructeur (supprimer, quitter), en rouge. */
  tone?: "accent" | "danger";
  /** Éteinte (hors ligne : le geste attend le serveur). */
  disabled?: boolean;
}

export const SheetAction = memo(function SheetAction({ icon: Icon, label, onPress, filled, tone, disabled }: SheetActionProps) {
  const theme = useTheme();
  const color = tone === "accent" ? accentTextOf(theme) : tone === "danger" ? theme.colors.status.error : theme.colors.text.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.4 : 1, backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
    >
      <View style={styles.icon}>
        <Icon size={20} color={color} fill={filled ? color : "transparent"} />
      </View>
      <Text style={[typography.body, { color, flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, borderRadius: 12 },
  icon: { width: 24, alignItems: "center" },
});
