import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { FilterSheet } from "./FilterSheet";
import type { ChoiceSheetModel, FilterSheetHandlers } from "./libraryTypes";
import { OPTION_ROW_HEIGHT, OptionRow } from "./OptionRow";

/**
 * La liste d'un critère à options : des CASES pour Genres et Plateformes
 * (plusieurs à la fois), des RONDS pour Visionnage (un seul). Sur une à trois
 * colonnes ; au-delà de `visibleRows` lignes, la liste défile dans le panneau
 * — sa hauteur est un nombre entier de lignes, pour qu'aucune ne soit coupée
 * au repos.
 *
 * Clés de focus : `sheet:option:<index>`.
 */

export const SHEET_PADDING = 48;
const COLUMN_GAP = 20;
const ROW_GAP = 10;
const PANEL_WIDTH = { 1: 760, 2: 1120, 3: 1440 } as const;

export const ChoiceSheet = memo(function ChoiceSheet({
  sheet,
  onSheetOption,
  onSheetClear,
  onSheetApply,
}: { sheet: ChoiceSheetModel } & FilterSheetHandlers) {
  const width = PANEL_WIDTH[sheet.columns];
  const inner = width - SHEET_PADDING * 2;
  const columnWidth = Math.floor((inner - COLUMN_GAP * (sheet.columns - 1)) / sheet.columns);
  const rows = Math.ceil(sheet.options.length / sheet.columns);
  const visible = Math.min(rows, sheet.visibleRows ?? 7);
  // Une rangée de plus que la fenêtre laisse voir : la liste défile.
  const scrolls = rows > visible;
  const height = visible * OPTION_ROW_HEIGHT + (visible - 1) * ROW_GAP;
  const grid = (
    <View style={[styles.grid, { columnGap: COLUMN_GAP, rowGap: ROW_GAP }]}>
      {sheet.options.map((option, index) => (
        <OptionRow
          key={option.id}
          label={option.label}
          detail={option.detail}
          selected={option.selected}
          mode={sheet.multiple ? "check" : "radio"}
          width={columnWidth}
          focusKey={`sheet:option:${index}`}
          onPress={onSheetOption ? () => onSheetOption(sheet.filter, option.id) : undefined}
        />
      ))}
    </View>
  );
  return (
    <FilterSheet
      title={sheet.title}
      subtitle={sheet.subtitle}
      width={width}
      applyLabel={sheet.applyLabel}
      clearLabel={sheet.clearLabel}
      onApply={onSheetApply}
      onClear={onSheetClear ? () => onSheetClear(sheet.filter) : undefined}
    >
      {scrolls ? (
        // Le débord laisse la place à l'agrandissement de la ligne focalisée.
        <ScrollView style={[styles.scroll, { height }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
    </FilterSheet>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  scroll: { marginHorizontal: -12 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 2 },
});
