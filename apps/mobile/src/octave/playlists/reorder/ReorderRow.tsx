/**
 * Octave mobile — une rangée de titre d'une liste qu'on peut réordonner : la rangée des pages (`TrackRow`,
 * m3), précédée en mode « Modifier » du bouton « retirer » (rouge, 44 pt) et suivie de la poignée (44 pt, la
 * seule zone qui glisse : le reste de la rangée lit et défile comme partout). Tenue, la rangée se soulève
 * (ombre, échelle 1,02) et suit le pouce ; les autres s'écartent en ressort. Au lecteur d'écran, la poignée
 * offre « Monter » et « Descendre » (le glisser a toujours son équivalent).
 */

import { memo, useLayoutEffect } from "react";
import { Pressable, StyleSheet, View, type GestureResponderHandlers } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { GripVertical, MinusCircle } from "lucide-react-native";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useTheme } from "@/theme";
import { TrackRow, TRACK_ROW_HEIGHT } from "../../pages";

const SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;

interface ReorderRowProps {
  track: MusicTrack;
  index: number;
  list: readonly MusicTrack[];
  contextId: string;
  playing: boolean;
  onPlay: (index: number) => void;
  gutter: number;
  /** Le décalage voulu pendant un glisser (une autre rangée est tenue), 0 sinon. */
  shift: number;
  /** Un glisser est en cours : les décalages vont en ressort ; sinon, aussitôt (l'ordre vient d'arriver). */
  dragging: boolean;
  active: boolean;
  lift: SharedValue<number>;
  /** La poignée : absente si l'ordre ne se change pas ici (recherche, filtre, tri sans écoutes…). */
  handle?: GestureResponderHandlers;
  onStep?: (index: number, delta: -1 | 1) => void;
  /** Mode « Modifier » d'une playlist modifiable : le bouton « retirer ». */
  onRemove?: (index: number) => void;
  /** Hors du mode « Modifier » : la rangée se balaie (« Lire ensuite », file). */
  swipeable: boolean;
}

export const ReorderRow = memo(function ReorderRow(props: ReorderRowProps) {
  const { track, index, list, contextId, playing, onPlay, gutter, shift, dragging, active, lift, handle, onStep, onRemove, swipeable } = props;
  const { t } = useTranslation("musicLists");
  const { t: tm } = useTranslation("music");
  const theme = useTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const raised = useSharedValue(0);

  // Avant la peinture : une rangée qui vient de changer de place n'est jamais vue décalée.
  useLayoutEffect(() => {
    offset.value = dragging && !reduced ? withSpring(shift, SPRING) : shift;
  }, [dragging, offset, reduced, shift]);
  useLayoutEffect(() => {
    raised.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: active ? 140 : 100 });
  }, [active, raised, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: active ? lift.value : offset.value }, { scale: 1 + raised.value * 0.02 }],
    zIndex: active ? 10 : 0,
    shadowOpacity: raised.value * 0.4,
    elevation: raised.value * 8,
  }));

  return (
    <Animated.View style={[styles.row, { backgroundColor: active ? theme.colors.surface.s2 : "transparent" }, style]}>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(index)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t("removeRow", { title: track.title })}
          style={[styles.remove, { marginLeft: gutter - 10 }]}
        >
          <MinusCircle size={22} color={theme.colors.status.error} />
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <TrackRow track={track} index={index} list={list} contextId={contextId} playing={playing} onPlay={onPlay} gutter={onRemove ? 4 : gutter} swipeable={swipeable} />
      </View>
      {handle ? (
        <View
          {...handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={tm("listOrder.handle", { title: track.title })}
          accessibilityHint={t("reorderHint")}
          accessibilityActions={[
            { name: "increment", label: t("moveUp") },
            { name: "decrement", label: t("moveDown") },
          ]}
          onAccessibilityAction={(e) => onStep?.(index, e.nativeEvent.actionName === "increment" ? -1 : 1)}
          style={[styles.handle, { marginRight: gutter - 10 }]}
        >
          <GripVertical size={20} color={active ? theme.colors.brand.accentLight : theme.colors.text.tertiary} />
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { height: TRACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  flex: { flex: 1, minWidth: 0 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 44, height: TRACK_ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
});
