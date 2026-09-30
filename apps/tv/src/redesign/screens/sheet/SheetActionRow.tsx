import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { BrandPill } from "../../brand/BrandPill";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { SheetGlyph } from "./SheetGlyph";
import type { SheetActionModel } from "./sheetTypes";

/**
 * Une ligne de la feuille : glyphe, libellé, et le complément à droite (la
 * position d'une reprise, l'épisode d'une série). Le focus la blanchit et la
 * grandit un peu — pas d'anneau.
 *
 * La lecture, en tête, et « Demander » (titre hors bibliothèque) portent la
 * MARQUE, comme toute action de lecture présentée en toutes lettres (héros,
 * fiche, « Lire maintenant ») : le dégradé violet → rose, qui s'allume au
 * focus au lieu de blanchir (`BrandPill`).
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
  if (action.kind === "play" || action.kind === "request") {
    return (
      <Animated.View style={lift}>
        <BrandPill progress={p} radius={RADIUS}>
          <Content action={action} ink={colors.onAccent} detail={colors.onAccent} strong />
        </BrandPill>
      </Animated.View>
    );
  }
  const ink = focused ? colors.ctaFg : colors.text;
  const glyph = action.kind === "favorite" && action.active ? (focused ? colors.accentDeep : colors.accentLight) : ink;
  return (
    <Animated.View style={[styles.plain, lift]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.light, light]} />
      <Content action={action} ink={ink} glyph={glyph} detail={focused ? scrim(0.56) : colors.textTertiary} />
    </Animated.View>
  );
}

function Content({ action, ink, glyph = ink, detail, strong = false }: {
  action: SheetActionModel;
  ink: string;
  glyph?: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.glyph}>
        <SheetGlyph kind={action.kind} active={action.active} color={glyph} />
      </View>
      <Text style={[styles.label, strong && styles.labelStrong, { color: ink }]} numberOfLines={1}>
        {action.label}
      </Text>
      {action.detail ? <Text style={[styles.detail, { color: detail }]}>{action.detail}</Text> : null}
    </View>
  );
}

const RADIUS = 24;

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 26 },
  plain: { borderRadius: RADIUS, backgroundColor: white(0.06) },
  light: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  glyph: { width: 32, alignItems: "center" },
  label: { ...fonts.semibold, fontSize: 28, flex: 1 },
  labelStrong: { ...fonts.bold },
  detail: { ...fonts.semibold, fontSize: 24, fontVariant: ["tabular-nums"] },
});
