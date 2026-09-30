import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chip } from "../../controls/Chip";
import { RoundButton } from "../../controls/RoundButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { colors, fonts, white } from "../../theme/tokens";
import { FilterSheet } from "./FilterSheet";
import type { FilterSheetHandlers, YearBoundModel, YearSheetModel } from "./libraryTypes";

/**
 * Les années : deux BORNES, « De » et « À », chacune réglée par ses flèches —
 * aucun clavier ne monte sans un geste explicite — et, dessous, des décennies
 * toutes faites qui posent les deux bornes d'un coup. Une borne libre s'écrit
 * « — ».
 *
 * Clés de focus : `sheet:from:prev|next`, `sheet:to:prev|next`,
 * `sheet:preset:<index>`.
 */

const WIDTH = 1320;
const INNER = WIDTH - 48 * 2;
const DASH = 64;
const BOUND_WIDTH = (INNER - DASH) / 2;

function Bound({ id, bound, stepLabels, onStep }: {
  id: "from" | "to";
  bound: YearBoundModel;
  stepLabels: YearSheetModel["stepLabels"];
  onStep?: (bound: "from" | "to", delta: -1 | 1) => void;
}) {
  return (
    <GlassSurface radius={30} tone="regular" style={styles.bound}>
      <Text style={styles.caption}>{bound.label}</Text>
      <View style={styles.stepper}>
        <RoundButton
          icon="chevronLeft"
          label={stepLabels.previous}
          size={72}
          focusKey={`sheet:${id}:prev`}
          onPress={onStep ? () => onStep(id, -1) : undefined}
        />
        <Text style={[styles.value, !bound.set && styles.valueUnset]} numberOfLines={1}>{bound.value}</Text>
        <RoundButton
          icon="chevronRight"
          label={stepLabels.next}
          size={72}
          focusKey={`sheet:${id}:next`}
          onPress={onStep ? () => onStep(id, 1) : undefined}
        />
      </View>
    </GlassSurface>
  );
}

export const YearSheet = memo(function YearSheet({
  sheet,
  onSheetOption,
  onSheetClear,
  onSheetApply,
  onYearStep,
}: { sheet: YearSheetModel } & FilterSheetHandlers) {
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
      <View style={styles.bounds}>
        <Bound id="from" bound={sheet.from} stepLabels={sheet.stepLabels} onStep={onYearStep} />
        <Text style={styles.dash}>–</Text>
        <Bound id="to" bound={sheet.to} stepLabels={sheet.stepLabels} onStep={onYearStep} />
      </View>
      <View style={styles.presets}>
        <Text style={styles.section}>{sheet.presetsTitle}</Text>
        <View style={styles.chips}>
          {sheet.presets.map((preset, index) => (
            <Chip
              key={preset.id}
              label={preset.label}
              selected={preset.selected}
              focusKey={`sheet:preset:${index}`}
              onPress={onSheetOption ? () => onSheetOption(sheet.filter, preset.id) : undefined}
            />
          ))}
        </View>
      </View>
    </FilterSheet>
  );
});

const styles = StyleSheet.create({
  bounds: { flexDirection: "row", alignItems: "center" },
  bound: { width: BOUND_WIDTH, paddingTop: 22, paddingBottom: 52, paddingHorizontal: 28, gap: 14 },
  caption: {
    ...fonts.semibold,
    fontSize: 22,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { ...fonts.extrabold, fontSize: 76, lineHeight: 86, letterSpacing: -1.5, color: colors.text, fontVariant: ["tabular-nums"] },
  valueUnset: { color: white(0.34) },
  dash: { ...fonts.bold, fontSize: 40, width: DASH, textAlign: "center", color: colors.textTertiary },
  presets: { gap: 16 },
  section: {
    ...fonts.semibold,
    fontSize: 22,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
});
