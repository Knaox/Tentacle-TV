import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme/tokens";
import { FilterSheet } from "./FilterSheet";
import type { FilterSheetHandlers, SortSheetModel } from "./libraryTypes";
import { OptionRow } from "./OptionRow";

/**
 * Le tri : à gauche le critère (Derniers ajouts, Titre A→Z, Année, Meilleures
 * notes), à droite l'ordre (décroissant, croissant) — deux choix uniques côte
 * à côte, chacun sous son intitulé. Choisir un critère pose son ordre
 * naturel ; l'intégration le fait (`SORT_OPTIONS`), la vue le montre.
 *
 * Clés de focus : `sheet:option:<index>` (critères), `sheet:order:<index>`.
 */

const WIDTH = 1180;
const LEFT = 620;
// Deux écarts de 20 et le filet de 1 entre les colonnes.
const RIGHT = WIDTH - 48 * 2 - LEFT - 41;

export const SortSheet = memo(function SortSheet({
  sheet,
  onSheetOption,
  onSheetClear,
  onSheetApply,
}: { sheet: SortSheetModel } & FilterSheetHandlers) {
  const pick = (id: string) => (onSheetOption ? () => onSheetOption(sheet.filter, id) : undefined);
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
      <View style={styles.columns}>
        <View style={[styles.column, { width: LEFT }]}>
          <Text style={styles.section}>{sheet.criteriaTitle}</Text>
          {sheet.criteria.map((option, index) => (
            <OptionRow
              key={option.id}
              label={option.label}
              selected={option.selected}
              mode="radio"
              width={LEFT}
              focusKey={`sheet:option:${index}`}
              onPress={pick(option.id)}
            />
          ))}
        </View>
        <View style={styles.rule} />
        <View style={[styles.column, { width: RIGHT }]}>
          <Text style={styles.section}>{sheet.orderTitle}</Text>
          {sheet.orders.map((option, index) => (
            <OptionRow
              key={option.id}
              label={option.label}
              selected={option.selected}
              mode="radio"
              width={RIGHT}
              focusKey={`sheet:order:${index}`}
              onPress={pick(option.id)}
            />
          ))}
        </View>
      </View>
    </FilterSheet>
  );
});

const styles = StyleSheet.create({
  columns: { flexDirection: "row", gap: 20 },
  column: { gap: 10 },
  rule: { width: 1, alignSelf: "stretch", backgroundColor: colors.borderSubtle },
  section: {
    ...fonts.semibold,
    fontSize: 22,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 6,
    marginLeft: 22,
  },
});
