/**
 * Octave mobile — une rangée du mode « Réordonner » d'une rubrique de la bibliothèque : la pochette, le nom,
 * et la poignée (44 pt, la seule zone qui glisse). Tenue, la rangée se soulève (ombre, échelle 1,02) et suit
 * le pouce ; les autres s'écartent en ressort. Au lecteur d'écran, la poignée offre « Monter » et
 * « Descendre » : le glisser a toujours son équivalent.
 */

import { memo, useLayoutEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, type GestureResponderHandlers } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { GripVertical } from "lucide-react-native";
import { typography, useTheme } from "@/theme";

export const SHELF_REORDER_ROW_HEIGHT = 64;
const SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;

interface Props {
  index: number;
  name: string;
  subtitle: string | null;
  art: ReactNode;
  gutter: number;
  shift: number;
  dragging: boolean;
  active: boolean;
  lift: SharedValue<number>;
  handle?: GestureResponderHandlers;
  onStep: (index: number, delta: -1 | 1) => void;
}

export const ShelfReorderRow = memo(function ShelfReorderRow({ index, name, subtitle, art, gutter, shift, dragging, active, lift, handle, onStep }: Props) {
  const { t } = useTranslation("musicFavorites");
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
    <Animated.View style={[styles.row, { paddingLeft: gutter, backgroundColor: active ? theme.colors.surface.s2 : "transparent" }, style]}>
      {art}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        {...handle}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("reorder.handle", { name })}
        accessibilityActions={[
          { name: "increment", label: t("reorder.moveUp", { name }) },
          { name: "decrement", label: t("reorder.moveDown", { name }) },
        ]}
        onAccessibilityAction={(e) => onStep(index, e.nativeEvent.actionName === "increment" ? -1 : 1)}
        style={[styles.handle, { marginRight: gutter - 10 }]}
      >
        <GripVertical size={20} color={active ? theme.colors.brand.accentLight : theme.colors.text.tertiary} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { height: SHELF_REORDER_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: "#000", shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  text: { flex: 1, minWidth: 0, gap: 2 },
  handle: { width: 44, height: SHELF_REORDER_ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
});
