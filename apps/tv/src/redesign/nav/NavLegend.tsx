import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";
import { ITEM_LEFT, LEGEND_HEIGHT } from "./navGeometry";

/**
 * La légende du rail déplié, en bas de la capsule : deux lignes courtes, un
 * pictogramme de touche et ce qu'elle fait — « ◀ Profil et réglages »,
 * « ⊙ Maintenir OK : organiser » ; pendant un déplacement, les touches du
 * déplacement. Jamais focalisable. Sa place est réservée repliée comme
 * dépliée (la géométrie ne bouge pas à l'ouverture) ; elle n'apparaît
 * qu'avec les libellés.
 */

export interface NavHint {
  icon: IconName;
  label: string;
}

const N = TV_STAGE.nav;

export const NavLegend = memo(function NavLegend({ hints, openness, top }: {
  hints: NavHint[];
  openness: SharedValue<number>;
  top: number;
}) {
  const shown = useAnimatedStyle(() => ({ opacity: openness.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.legend, { top }, shown]}>
      {hints.map((hint) => (
        <View key={hint.label} style={styles.row}>
          <View style={styles.glyph}>
            <Icon name={hint.icon} size={24} color={colors.textTertiary} strokeWidth={2.2} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {hint.label}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  legend: {
    position: "absolute",
    left: ITEM_LEFT,
    width: N.expandedWidth - ITEM_LEFT * 2,
    height: LEGEND_HEIGHT,
    justifyContent: "center",
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", height: 30 },
  // Aligné sur les pictogrammes et les libellés des entrées.
  glyph: { width: N.itemHeight, alignItems: "center" },
  label: { ...fonts.medium, fontSize: 22, lineHeight: 30, color: colors.textTertiary, flex: 1, marginLeft: 4 },
});
