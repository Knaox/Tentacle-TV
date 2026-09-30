import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { railMaxOffset, railThumb } from "@tentacle-tv/tv-core";
import { white } from "../theme/tokens";
import { INDICATOR, LIST_GEOMETRY, LIST_HEIGHT } from "./navGeometry";

/**
 * L'indicateur de position de la liste — la « barre de défilement » de la
 * navigation, discrète : une piste fine au bord droit de la capsule, un
 * curseur proportionnel à la part visible. Repliée comme dépliée : deux
 * pistes, l'une au bord de la barre repliée, l'autre de la barre ouverte,
 * qui passent de l'une à l'autre avec le verre (`openness`). Absent quand
 * tout tient.
 *
 * Le curseur ne fait que glisser (`translateY`, sur le fil de l'interface) :
 * rien ne se repeint quand la liste défile.
 */

const N = TV_STAGE.nav;
const TRACK = LIST_HEIGHT - INDICATOR.marginY * 2;

export const NavScrollIndicator = memo(function NavScrollIndicator({
  count,
  openness,
  scrollY,
}: {
  count: number;
  openness: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const thumb = railThumb(count, LIST_GEOMETRY, TRACK);
  const max = railMaxOffset(count, LIST_GEOMETRY);
  const travel = thumb?.travel ?? 0;
  const move = useAnimatedStyle(() => ({
    transform: [{ translateY: max > 0 ? travel * Math.min(1, Math.max(0, scrollY.value / max)) : 0 }],
  }));
  const narrow = useAnimatedStyle(() => ({ opacity: 1 - openness.value }));
  const wide = useAnimatedStyle(() => ({ opacity: openness.value }));
  if (!thumb) return null;
  const track = (left: number, fadeStyle: typeof narrow) => (
    <Animated.View pointerEvents="none" style={[styles.track, { left }, fadeStyle]}>
      <Animated.View style={[styles.thumb, { height: thumb.size }, move]} />
    </Animated.View>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {track(N.collapsedWidth - INDICATOR.inset - INDICATOR.width, narrow)}
      {track(N.expandedWidth - INDICATOR.inset - INDICATOR.width, wide)}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    top: INDICATOR.marginY,
    width: INDICATOR.width,
    height: TRACK,
    borderRadius: INDICATOR.width / 2,
    backgroundColor: white(0.08),
  },
  thumb: { width: INDICATOR.width, borderRadius: INDICATOR.width / 2, backgroundColor: white(0.42) },
});
