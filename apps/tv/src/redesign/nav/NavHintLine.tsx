import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Icon, type IconName } from "../icons/Icon";
import { useEntrance } from "../motion/useMotion";
import { colors } from "../theme/tokens";
import { navText } from "./navText";

/**
 * Une ASTUCE du rail ouvert — « Maintenir OK : organiser », « ◀ Réglages » :
 * UNE ligne courte, à droite du rail, à hauteur de ce qu'elle concerne. Elle
 * paraît au focus, sans attendre, en un fondu bref et un glissé de quelques
 * points depuis le rail (`opacity` et `transform` seulement) ; elle ne prend
 * aucune place dans la colonne et n'est jamais focalisable. QUAND elle
 * paraît, c'est tv-core qui le dit (`nav/railHint`) ; elle se remonte à
 * chaque entrée qu'elle accompagne.
 */

const HEIGHT = 40;
const SLIDE = 8;

export const NavHintLine = memo(function NavHintLine({ icon, label, center, left, scrollY }: {
  icon: IconName;
  label: string;
  /** Le centre de ce qu'elle accompagne (une entrée de la liste en haut, le profil). */
  center: number;
  left: number;
  /** Le défilement de la liste, pour une ligne qui suit son entrée ; aucun pour le profil, ancré. */
  scrollY?: SharedValue<number>;
}) {
  const p = useEntrance("reveal");
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: center - HEIGHT / 2 - (scrollY ? scrollY.value : 0) }, { translateX: -SLIDE * (1 - p.value) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.pill, { left }, style]}>
      {/* Elle passe sur le contenu : un fond dense la garde lisible. */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <Icon name={icon} size={20} color={colors.textTertiary} strokeWidth={2.2} />
      <Text style={[navText.hint, styles.label]} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: { position: "absolute", top: 0, height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  base: { borderRadius: HEIGHT / 2, backgroundColor: "rgba(10, 10, 14, 0.82)" },
  label: { color: colors.textSecondary },
});
