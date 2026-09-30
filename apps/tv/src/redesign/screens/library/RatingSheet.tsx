import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";
import { FilterSheet } from "./FilterSheet";
import type { FilterSheetHandlers, RatingSheetModel, RatingStop } from "./libraryTypes";

/**
 * La note minimum : une échelle de PALIERS (0 à 10, par demi-point), la
 * valeur retenue écrite en grand au-dessus. Ce qui passe le filtre — du
 * palier retenu jusqu'à 10 — reste allumé sur la piste ; le palier retenu
 * porte la touche ambre. Au focus, un palier devient une pastille blanche qui
 * dit sa valeur.
 *
 * Clés de focus : `sheet:stop:<index>`.
 */

const WIDTH = 1440;
const INNER = WIDTH - 48 * 2;
const STOP = 64;

function Stop({ stop, index, onSelect }: { stop: RatingStop; index: number; onSelect?: (value: number) => void }) {
  return (
    <FocusTarget
      focusKey={`sheet:stop:${index}`}
      onPress={onSelect ? () => onSelect(stop.value) : undefined}
      accessibilityLabel={stop.label}
      style={styles.stop}
    >
      {(focused) => <StopBody stop={stop} focused={focused} whole={Number.isInteger(stop.value)} />}
    </FocusTarget>
  );
}

function StopBody({ stop, focused, whole }: { stop: RatingStop; focused: boolean; whole: boolean }) {
  const p = useFocusProgress(focused, 180);
  const bubble = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.55 + 0.45 * p.value }] }));
  return (
    <View style={styles.stopInner}>
      <View style={styles.dotBox}>
        {stop.selected ? (
          <View style={styles.selected} />
        ) : (
          <View style={[styles.dot, whole && styles.dotWhole, { backgroundColor: stop.kept ? white(0.92) : white(0.3) }]} />
        )}
        <Animated.View style={[styles.bubble, bubble]}>
          <Text style={styles.bubbleText} numberOfLines={1}>{stop.label}</Text>
        </Animated.View>
      </View>
      {whole ? (
        <Text style={[styles.tick, stop.selected && styles.tickOn]}>{stop.label}</Text>
      ) : null}
    </View>
  );
}

export const RatingSheet = memo(function RatingSheet({
  sheet,
  onSheetClear,
  onSheetApply,
  onRatingSelect,
}: { sheet: RatingSheetModel } & FilterSheetHandlers) {
  const selectedIndex = Math.max(0, sheet.stops.findIndex((stop) => stop.selected));
  const pitch = INNER / sheet.stops.length;
  const keptLeft = pitch * selectedIndex + pitch / 2;
  return (
    <FilterSheet
      title={sheet.title}
      subtitle={sheet.subtitle}
      width={WIDTH}
      applyLabel={sheet.applyLabel}
      clearLabel={sheet.clearLabel}
      onApply={onSheetApply}
      onClear={onSheetClear ? () => onSheetClear(sheet.filter) : undefined}
    >
      <View style={styles.readout}>
        {sheet.readoutValue ? (
          <>
            <Icon name="star" size={56} color={colors.accentLight} />
            <Text style={styles.readoutValue}>{sheet.readoutValue}</Text>
            <Text style={styles.readoutText}>{sheet.readoutText}</Text>
          </>
        ) : (
          <Text style={styles.readoutAll}>{sheet.readoutText}</Text>
        )}
      </View>
      <View style={styles.scale}>
        <View style={[styles.track, { left: pitch / 2, right: pitch / 2 }]} />
        <View style={[styles.kept, { left: keptLeft, right: pitch / 2 }]} />
        <View style={styles.stops}>
          {sheet.stops.map((stop, index) => (
            <Stop key={stop.value} stop={stop} index={index} onSelect={onRatingSelect} />
          ))}
        </View>
      </View>
    </FilterSheet>
  );
});

const TRACK_Y = STOP / 2 - 3;

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, height: 120 },
  readoutValue: { ...fonts.extrabold, fontSize: 96, lineHeight: 110, letterSpacing: -2, color: colors.text },
  readoutText: { ...fonts.semibold, fontSize: 34, color: colors.textSecondary, marginTop: 24 },
  readoutAll: { ...fonts.extrabold, fontSize: 72, letterSpacing: -1.2, color: colors.text },
  scale: { width: INNER, marginBottom: 8 },
  track: { position: "absolute", top: TRACK_Y, height: 6, borderRadius: 3, backgroundColor: white(0.14) },
  kept: { position: "absolute", top: TRACK_Y, height: 6, borderRadius: 3, backgroundColor: white(0.62) },
  stops: { flexDirection: "row" },
  stop: { flex: 1 },
  stopInner: { alignItems: "center" },
  dotBox: { width: STOP, height: STOP, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotWhole: { width: 16, height: 16, borderRadius: 8 },
  selected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.text,
  },
  bubble: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ctaBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  bubbleText: { ...fonts.extrabold, fontSize: 22, color: colors.ctaFg, letterSpacing: -0.4 },
  tick: { ...fonts.semibold, fontSize: 22, color: colors.textTertiary, marginTop: 8 },
  tickOn: { ...fonts.extrabold, color: colors.text },
});
