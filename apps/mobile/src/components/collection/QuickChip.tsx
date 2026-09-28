import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FONT_FAMILY, RADIUS, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/**
 * La pastille de la barre rapide (`LibraryQuickBar`) : 36 de haut, aplat
 * `surface.s1`, liseré `border.strong` ; choisie, teinte `brand.soft` et
 * liseré `brand.glow`. Ma liste et Mes favoris la reprennent pour leurs
 * propres réglages (tri, grille ou liste, regroupement, sélection).
 */
export function QuickChip({ onPress, label, active = false, role = "button", children }: {
  onPress: () => void;
  /** Étiquette accessible — obligatoire quand le contenu n'est qu'une icône. */
  label?: string;
  active?: boolean;
  /** `radio` dans un groupe exclusif (regroupement). */
  role?: "button" | "radio";
  children: ReactNode;
}) {
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === "radio" ? { checked: active } : { selected: active }}
      style={({ pressed }) => [st.chip, active && st.chipActive, pressed && st.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** Le texte d'une pastille : 13 semi-gras, violet quand elle est choisie. */
export function QuickChipText({ children, active = false }: { children: ReactNode; active?: boolean }) {
  const st = useThemedStyles(makeStyles);
  return <Text style={[st.text, active && st.textActive]} numberOfLines={1}>{children}</Text>;
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  chip: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.strong,
    backgroundColor: t.colors.surface.s1,
  },
  chipActive: { borderColor: t.colors.brand.glow, backgroundColor: withAlpha(t.colors.brand.violet, 0.16, t.colors.surface.s1) },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  text: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  textActive: { color: t.colors.brand.light },
});
