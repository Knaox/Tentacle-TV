import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  /**
   * Le glyphe de l'anneau, dessiné à la couleur de l'état — les tracés
   * partagés des cartes pour les bascules (`cardGlyphs`), Feather ailleurs.
   */
  renderIcon?: (color: string) => ReactNode;
  /** Icône Feather, quand aucun `renderIcon` n'est fourni. */
  icon?: keyof typeof Feather.glyphMap;
  /** L'état d'une BASCULE ; absent pour une action simple (fiche, refus). */
  active?: boolean;
  /** Couleur de l'état actif (anneau teinté, glyphe, libellé). */
  activeColor?: string;
  /** Un anneau sur mesure (le glyphe du hors ligne), à la place de l'anneau standard. */
  ring?: ReactNode;
  /** Gabarit imposé par la grille (largeur de colonne) ; `flex: 1` sinon. */
  style?: StyleProp<ViewStyle>;
  /** Lignes du libellé au plus (défaut 2) — trois pour les libellés « … dès son arrivée ». */
  lines?: number;
}

/**
 * Cellule d'action ronde de la feuille d'appui long (style Apple TV +) : un
 * anneau de 60, le libellé dessous, deux lignes au plus (`lines`). Une bascule annonce
 * son état (`selected`) et teinte son anneau ; une action simple reste
 * neutre. La cellule entière est la cible tactile, bien au-delà de 44 pt.
 */
export function ActionCell({ label, onPress, renderIcon, icon, active, activeColor, ring, style, lines = 2 }: Props) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const on = active === true;
  const tint = activeColor ?? colors.brand.violet;
  const ringBg = on ? withAlpha(tint, 0.13, colors.brand.soft) : colors.fill.subtle;
  const ringBorder = on ? withAlpha(tint, 0.33, colors.brand.glow) : colors.border.subtle;
  const iconColor = on ? tint : colors.text.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [st.cell, style, pressed && st.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: on }}
    >
      {ring ?? (
        <View style={[st.ring, { backgroundColor: ringBg, borderColor: ringBorder }]}>
          {renderIcon ? renderIcon(iconColor) : icon ? <Feather name={icon} size={26} color={iconColor} /> : null}
        </View>
      )}
      <Text numberOfLines={lines} style={[st.cellLabel, { color: on ? tint : colors.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    cell: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 8, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.faint },
    pressed: { opacity: 0.75 },
    ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    cellLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, fontSize: 12.5, textAlign: "center", letterSpacing: 0.1, lineHeight: 15 },
  });
