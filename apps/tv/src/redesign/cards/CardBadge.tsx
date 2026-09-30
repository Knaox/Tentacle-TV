import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme/tokens";

/**
 * L'étiquette en haut à gauche d'une carte : « Découverte », « +3 ». La même
 * pastille ambre que `MediaCard`, pour les cartes qui la composent à part
 * (`MorphCard`). Jamais au centre de l'image.
 */
export const CardBadge = memo(function CardBadge({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.badge, compact && styles.compact]}>
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  compact: { top: 10, left: 10, paddingHorizontal: 10 },
  text: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
});
