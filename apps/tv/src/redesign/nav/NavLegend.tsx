import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors } from "../theme/tokens";
import { navText } from "./navText";

/**
 * La légende du rail ouvert : une bulle de verre posée à DROITE du rail, en
 * bas, à côté du bloc du profil — une ligne par touche, un pictogramme de
 * touche et ce qu'elle fait : « ◀ Profil et réglages » (la flèche montre le
 * profil, à sa gauche), « ⊙ Maintenir OK : organiser » ; pendant un
 * déplacement, les touches du déplacement. Jamais focalisable.
 *
 * Hors du rail exprès : dans la colonne, elle réservait sa place sous le bloc
 * des pages (le bloc n'était plus centré dès que l'élément des demandes était
 * là) et dictait la largeur du rail ouvert (sa ligne la plus longue l'était
 * plus que tous les libellés). Ici, elle se cale sur son propre texte.
 *
 * Montée seulement rail ouvert, quand le moteur de focus est dans le rail :
 * elle recouvre le contenu, jamais pendant qu'on y navigue. Elle paraît avec
 * le verre (`openness`), glissée depuis le rail.
 */

export interface NavHint {
  icon: IconName;
  label: string;
}

/** Ce dont la bulle glisse depuis le rail en paraissant, en points. */
const SLIDE = 12;
const RADIUS = 28;

export const NavLegend = memo(function NavLegend({ hints, openness, left, bottom }: {
  hints: NavHint[];
  openness: SharedValue<number>;
  /** Son bord gauche : un écart après le rail ouvert. */
  left: number;
  /** Son bord bas, depuis le bas de l'écran : celui du bloc du profil. */
  bottom: number;
}) {
  const shown = useAnimatedStyle(() => ({ opacity: openness.value, transform: [{ translateX: -SLIDE * (1 - openness.value) }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.card, { left, bottom }, shown]}>
      {/* Elle passe sur le contenu : le verre dessiné ne floute rien, un fond
          dense garde la légende lisible (le même que le menu d'une entrée). */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
      {hints.map((hint) => (
        <View key={hint.label} style={styles.row}>
          <Icon name={hint.icon} size={24} color={colors.textTertiary} strokeWidth={2.2} />
          <Text style={[navText.hint, styles.label]} numberOfLines={1}>
            {hint.label}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { position: "absolute", paddingHorizontal: 22, paddingVertical: 14, gap: 8, borderRadius: RADIUS },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.9)" },
  row: { flexDirection: "row", alignItems: "center", height: 30, gap: 14 },
  label: { color: colors.textSecondary },
});
