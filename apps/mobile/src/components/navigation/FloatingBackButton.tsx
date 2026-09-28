import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/** Le rond du retour flottant, en points. */
export const FLOATING_BACK_SIZE = 40;

/**
 * Le retour des écrans empilés qui défilent sous la zone sûre (une
 * bibliothèque ouverte d'ailleurs, Ma liste, Mes favoris) : un rond de 40 qui
 * reste à portée du pouce pendant tout le défilement.
 *
 * Pas de flou : la grille défile dessous, un flou y serait recalculé à chaque
 * image. Un aplat translucide et un liseré suffisent à le détacher.
 */
export function FloatingBackButton({ top, onPress }: { top: number; onPress: () => void }) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={[st.wrap, { top: top + spacing.xs }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        style={({ pressed }) => [st.back, pressed && st.pressed]}
      >
        <Feather name="chevron-left" size={24} color={colors.text.primary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { position: "absolute", left: spacing.screenPadding - 4 },
  back: {
    width: FLOATING_BACK_SIZE,
    height: FLOATING_BACK_SIZE,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(t.colors.surface.s0, 0.72, t.colors.surface.s0),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.strong,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
