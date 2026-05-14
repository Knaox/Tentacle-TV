import { Pressable, View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, BORDER, FONT_FAMILY, RADIUS } from "@/theme";

interface Props {
  icon: keyof typeof Feather.glyphMap;
  iconActive?: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  activeColor: string;
  fillOnActive?: boolean;
  onPress: () => void;
}

/**
 * Action button rond — pattern Apple TV / Disney+ (R1 + R3 MASTER design-system).
 *
 *  • Cellule LARGEUR FIXE 25% (4 colonnes), HAUTEUR FIXE 88pt (ring + gap + label).
 *  • Label 1 ligne max (ellipsis si trop long) → grille uniforme garantie.
 *  • Ring 52×52, touch target ≥44pt garanti via hitSlop interne.
 *  • Active : ring `{color}22` bg + `{color}55` border + icon `{color}` + label `{color}`.
 *  • Inactive : ring `white/6` bg + BORDER.subtle + icon white/85 + label white/62.
 *  • Toggle via couleur seulement — labels courts identiques active/inactive (R2).
 */
export function DetailActionButton({ icon, iconActive, label, active, activeColor, fillOnActive, onPress }: Props) {
  const ringBg = active ? `${activeColor}22` : "rgba(255,255,255,0.06)";
  const ringBorder = active ? `${activeColor}55` : BORDER.subtle;
  const iconColor = active ? activeColor : "rgba(255,255,255,0.92)";
  const iconName = (active && iconActive) ? iconActive : icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [st.cell, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
    >
      <View style={[st.ring, { backgroundColor: ringBg, borderColor: ringBorder }]}>
        <Feather
          name={iconName}
          size={22}
          color={iconColor}
        />
        {fillOnActive && active && (
          // Overlay filled solid (Feather est outline only — pour un "filled" visuel
          // on superpose un fond couleur dans le ring; le visual reste cohérent).
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]} pointerEvents="none" />
        )}
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[st.label, { color: active ? activeColor : "rgba(255,255,255,0.7)" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  cell: {
    // Largeur fixe 25% (4 colonnes). Hauteur fixe pour grille uniforme.
    width: "25%" as unknown as number,
    height: 88,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
    gap: 8,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    ...typography.badge,
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    textAlign: "center",
    maxWidth: 80,
  },
});
