import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chip } from "../../controls/Chip";
import { colors, fonts } from "../../theme/tokens";
import { FilterPill } from "./FilterPill";
import type { ActiveFilterModel, FilterPillModel, LibraryFilterKey } from "./libraryTypes";

/**
 * La barre de filtres, façon Netflix : une rangée de pastilles — une par
 * critère, chacune avec sa valeur courante — puis, dès qu'un filtre est posé,
 * la rangée des filtres ACTIFS : chacun se retire d'un geste (sa croix), et
 * « Tout effacer » les retire tous. Le tri n'y figure pas : il ordonne, il
 * ne retire rien.
 *
 * Clés de focus : `pill:<critère>`, `active:<index>`, `active:clear`.
 */

export interface FilterBarProps {
  pills: FilterPillModel[];
  active: ActiveFilterModel[];
  labels: { activeFilters: string; clearAll: string };
  onPressPill?: (key: LibraryFilterKey) => void;
  onRemoveFilter?: (id: string) => void;
  onClearAll?: () => void;
}

export const FilterBar = memo(function FilterBar({ pills, active, labels, onPressPill, onRemoveFilter, onClearAll }: FilterBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.pills}>
        {pills.map((pill) => (
          <FilterPill
            key={pill.key}
            pill={pill}
            focusKey={`pill:${pill.key}`}
            onPress={onPressPill ? () => onPressPill(pill.key) : undefined}
          />
        ))}
      </View>
      {active.length > 0 ? (
        <View style={styles.active}>
          <Text style={styles.activeLabel}>{labels.activeFilters}</Text>
          {active.map((filter, index) => (
            <Chip
              key={filter.id}
              label={filter.label}
              trailingIcon="close"
              selected
              size="md"
              focusKey={`active:${index}`}
              onPress={onRemoveFilter ? () => onRemoveFilter(filter.id) : undefined}
            />
          ))}
          <View style={styles.divider} />
          <Chip label={labels.clearAll} icon="refresh" size="md" focusKey="active:clear" onPress={onClearAll} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { gap: 26 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  active: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  activeLabel: { ...fonts.semibold, fontSize: 22, color: colors.textTertiary, marginRight: 6 },
  divider: { width: 1, height: 34, marginHorizontal: 6, backgroundColor: colors.borderStrong },
});
