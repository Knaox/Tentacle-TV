/**
 * Octave (mobile) — une SECTION de page (« Écoutés récemment », « Albums »…) :
 * son titre, un « Tout voir » éventuel (cible ≥ 44 pt), puis son contenu.
 * Une étagère horizontale garde la marge de page à gauche et défile jusqu'au bord.
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useOctaveColors } from "../theme/octaveColors";
import { useOctaveLayout } from "./useOctaveLayout";

interface Props {
  title: string;
  /** « Tout voir » : son libellé et son geste. */
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

export const OctaveSection = memo(function OctaveSection({ title, action, children }: Props) {
  const colors = useOctaveColors();
  const { gutter, isTablet } = useOctaveLayout();
  return (
    <View style={{ marginBottom: isTablet ? 36 : 28 }}>
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10} style={styles.action} accessibilityRole="button" accessibilityLabel={`${action.label} — ${title}`}>
            <Text style={[styles.actionLabel, { color: colors.accentText }]}>{action.label}</Text>
            <ChevronRight size={16} color={colors.accentText} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, minHeight: 32 },
  title: { fontSize: 21, fontWeight: "700", letterSpacing: -0.3, flexShrink: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingLeft: 12 },
  actionLabel: { fontSize: 15, fontWeight: "600" },
});
