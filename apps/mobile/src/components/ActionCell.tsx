import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  icon: keyof typeof Feather.glyphMap;
  iconActive?: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  activeColor: string;
  fillOnActive?: boolean;
  onPress: () => void;
  /** Un contenu d'anneau sur mesure (le glyphe du hors ligne), à la place de l'icône. */
  ring?: React.ReactNode;
}

/** Cellule d'action ronde de la feuille d'appui long (style Apple TV +). */
export function ActionCell({ icon, iconActive, label, active, activeColor, fillOnActive, onPress, ring }: Props) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const ringBg = active ? withAlpha(activeColor, 0.13, colors.brand.soft) : colors.fill.subtle;
  const ringBorder = active ? withAlpha(activeColor, 0.33, colors.brand.glow) : colors.border.subtle;
  const iconColor = active ? activeColor : colors.text.primary;
  const iconName = (active && iconActive) ? iconActive : icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [st.cell, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {ring ?? (
        <View style={[st.ring, { backgroundColor: ringBg, borderColor: ringBorder }]}>
          <Feather name={iconName} size={26} color={iconColor} fill={fillOnActive && active ? activeColor : "none"} />
        </View>
      )}
      <Text numberOfLines={2} style={[st.cellLabel, { color: active ? activeColor : colors.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    cell: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 10, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.faint },
    ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    cellLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, fontSize: 12.5, textAlign: "center", letterSpacing: 0.1, lineHeight: 15 },
  });
