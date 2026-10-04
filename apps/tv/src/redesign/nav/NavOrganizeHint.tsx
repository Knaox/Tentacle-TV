import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Icon } from "../icons/Icon";
import { useEntrance } from "../motion/useMotion";
import { colors } from "../theme/tokens";
import { navText } from "./navText";

/**
 * « Maintenir OK : organiser » — UNE ligne courte, à droite du rail ouvert, à
 * hauteur de l'entrée focalisée qu'elle concerne. Elle paraît doucement (un
 * fondu, un glissé de quelques points depuis le rail), ne prend aucune place
 * dans la colonne et n'est jamais focalisable. QUAND elle paraît, c'est
 * l'intégration qui le dit (tv-core `railHint` : après un temps de focus, les
 * premières fois seulement) ; elle se remonte à chaque entrée.
 */

const HEIGHT = 40;
const SLIDE = 8;

export const NavOrganizeHint = memo(function NavOrganizeHint({ label, center, left, scrollY }: {
  label: string;
  /** Le centre de l'entrée, liste en haut (`listEntryCenter`). */
  center: number;
  left: number;
  /** Le défilement de la liste : la ligne suit son entrée. */
  scrollY: SharedValue<number>;
}) {
  const p = useEntrance("reveal");
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: center - HEIGHT / 2 - scrollY.value }, { translateX: -SLIDE * (1 - p.value) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.pill, { left }, style]}>
      {/* Elle passe sur le contenu : un fond dense la garde lisible (celui de la légende). */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <Icon name="circleDot" size={20} color={colors.textTertiary} strokeWidth={2.2} />
      <Text style={[navText.hint, styles.label]} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: { position: "absolute", top: 0, height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  base: { borderRadius: HEIGHT / 2, backgroundColor: "rgba(10, 10, 14, 0.82)" },
  label: { color: colors.textSecondary },
});
