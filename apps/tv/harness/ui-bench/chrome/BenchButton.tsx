import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND } from "@tentacle-tv/shared/theme";

/**
 * Le bouton du catalogue — outil, pas maquette : rien ici n'est une brique de
 * la refonte. Lisible de loin au clavier du simulateur (flèches, Entrée).
 */
export const BenchButton = memo(function BenchButton({
  label,
  detail,
  active = false,
  preferred = false,
  onPress,
}: {
  label: string;
  detail?: string;
  active?: boolean;
  preferred?: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  // `hasTVPreferredFocus` : le premier bouton du catalogue prend le focus à
  // l'ouverture — c'est un outil du banc, pas une vue de la refonte.
  const tvProps = preferred ? ({ hasTVPreferredFocus: true } as object) : {};
  return (
    <Pressable
      {...tvProps}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.button, active && styles.active, focused && styles.focused]}
    >
      <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1}>{label}</Text>
      {detail ? (
        <View style={[styles.badge, focused && styles.badgeFocused]}>
          <Text style={[styles.detail, focused && styles.labelFocused]}>{detail}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  active: { borderColor: BRAND.light },
  focused: { backgroundColor: "#FFFFFF", transform: [{ scale: 1.06 }] },
  label: { color: "#FFFFFF", fontSize: 26, fontWeight: "600" },
  labelFocused: { color: "#000000" },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.14)" },
  badgeFocused: { backgroundColor: "rgba(0, 0, 0, 0.12)" },
  detail: { color: "rgba(255, 255, 255, 0.78)", fontSize: 22, fontWeight: "600" },
});
