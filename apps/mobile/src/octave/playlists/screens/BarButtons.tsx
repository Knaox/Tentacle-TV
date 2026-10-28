/**
 * Octave mobile — les boutons de la barre du haut d'une page de liste : un rond de verre (44 pt) pour une
 * icône, une capsule de verre pour un mot (« Modifier », « OK »). Verre de Tentacle (`GlassSurface` : Liquid
 * Glass sur iOS 26, flou ailleurs), comme le retour de la page.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";

export const GlassIconButton = memo(function GlassIconButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <GlassSurface tier="subtle" tint="regular" radius={22} interactive style={styles.round}>
        <Icon size={20} color={theme.colors.text.primary} />
      </GlassSurface>
    </Pressable>
  );
});

export const GlassTextButton = memo(function GlassTextButton({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button">
      <GlassSurface tier="subtle" tint="regular" radius={22} interactive style={styles.pill}>
        <Text style={[typography.bodyBold, { color: strong ? theme.colors.brand.accentLight : theme.colors.text.primary }]}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  round: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pill: { minHeight: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
});
