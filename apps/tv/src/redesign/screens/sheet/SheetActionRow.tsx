import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { SheetGlyph } from "./SheetGlyph";
import type { SheetActionModel } from "./sheetTypes";

/**
 * Une ligne de la feuille : glyphe, libellé, et le complément à droite (la
 * position d'une reprise, l'épisode d'une série). Le focus la blanchit et la
 * grandit un peu — pas d'anneau. La lecture, en tête, est un cran plus
 * présente au repos ; « Demander » (titre hors bibliothèque) porte l'accent.
 */

export const ROW_HEIGHT = 78;

export const SheetActionRow = memo(function SheetActionRow({
  action,
  focusKey,
  onPress,
}: {
  action: SheetActionModel;
  focusKey: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} accessibilityLabel={action.label}>
      {(focused) => <Row action={action} focused={focused} />}
    </FocusTarget>
  );
});

function Row({ action, focused }: { action: SheetActionModel; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  const request = action.kind === "request";
  const primary = request || action.kind === "play";
  const ink = focused ? colors.ctaFg : request ? colors.onAccent : colors.text;
  const glyphColor =
    action.kind === "favorite" && action.active ? (focused ? colors.accentDeep : colors.accentLight) : ink;
  return (
    <Animated.View style={[styles.row, primary && styles.primary, request && styles.request, lift]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.light, light]} />
      <View style={styles.glyph}>
        <SheetGlyph kind={action.kind} active={action.active} color={glyphColor} />
      </View>
      <Text style={[styles.label, primary && styles.labelPrimary, { color: ink }]} numberOfLines={1}>
        {action.label}
      </Text>
      {action.detail ? (
        <Text style={[styles.detail, { color: focused ? scrim(0.56) : request ? scrim(0.6) : colors.textTertiary }]}>
          {action.detail}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 26,
    borderRadius: 24,
    backgroundColor: white(0.06),
  },
  primary: { backgroundColor: white(0.14) },
  request: { backgroundColor: colors.accent },
  light: { borderRadius: 24, backgroundColor: colors.ctaBg },
  glyph: { width: 32, alignItems: "center" },
  label: { ...fonts.semibold, fontSize: 28, flex: 1 },
  labelPrimary: { ...fonts.bold },
  detail: { ...fonts.semibold, fontSize: 24, fontVariant: ["tabular-nums"] },
});
