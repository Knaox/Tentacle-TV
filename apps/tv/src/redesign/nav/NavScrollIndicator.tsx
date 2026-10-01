import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { railMaxOffset, railThumb, type RailScrollGeometry } from "@tentacle-tv/tv-core";
import { white } from "../theme/tokens";
import { COLLAPSED_WIDTH, INDICATOR } from "./navGeometry";

/**
 * L'indicateur de position de la liste — la « barre de défilement » de la
 * navigation, discrète : une piste fine au bord droit de la capsule, un
 * curseur proportionnel à la part visible. Repliée comme dépliée : deux
 * pistes, l'une au bord de la bande repliée, l'autre du rail ouvert, qui
 * passent de l'une à l'autre avec le verre (`openness`). Absent quand tout
 * tient — le bloc des pages, alors, est haut comme ses entrées.
 *
 * Le curseur ne fait que glisser (`translateY`, sur le fil de l'interface) :
 * rien ne se repeint quand la liste défile.
 */

export const NavScrollIndicator = memo(function NavScrollIndicator({
  count,
  geometry,
  expandedWidth,
  openness,
  scrollY,
}: {
  count: number;
  geometry: RailScrollGeometry;
  expandedWidth: number;
  openness: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const track = geometry.viewport - INDICATOR.marginY * 2;
  const thumb = railThumb(count, geometry, track);
  const max = railMaxOffset(count, geometry);
  const travel = thumb?.travel ?? 0;
  const move = useAnimatedStyle(
    () => ({ transform: [{ translateY: max > 0 ? travel * Math.min(1, Math.max(0, scrollY.value / max)) : 0 }] }),
    [max, travel],
  );
  const narrow = useAnimatedStyle(() => ({ opacity: 1 - openness.value }));
  const wide = useAnimatedStyle(() => ({ opacity: openness.value }));
  if (!thumb) return null;
  const rail = (left: number, fadeStyle: typeof narrow) => (
    <Animated.View pointerEvents="none" style={[styles.track, { left, height: track }, fadeStyle]}>
      <Animated.View style={[styles.thumb, { height: thumb.size }, move]} />
    </Animated.View>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rail(COLLAPSED_WIDTH - INDICATOR.insetCollapsed - INDICATOR.width, narrow)}
      {rail(expandedWidth - INDICATOR.insetExpanded - INDICATOR.width, wide)}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    top: INDICATOR.marginY,
    width: INDICATOR.width,
    borderRadius: INDICATOR.width / 2,
    backgroundColor: white(0.08),
  },
  thumb: { width: INDICATOR.width, borderRadius: INDICATOR.width / 2, backgroundColor: white(0.42) },
});
