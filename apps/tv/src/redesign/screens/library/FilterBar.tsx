import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chip } from "../../controls/Chip";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
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
 * Clés de focus : `pill:<critère>`, `active:<index>`, `active:clear`. Clé de
 * groupe : `filters` — la barre entière, sur toute la largeur de la page : de
 * n'importe quelle affiche, « haut » y trouve une cible, même sous une colonne
 * qu'aucune pastille ne couvre. Ses deux lignes sont des SECTIONS
 * (`filters:pills`, `filters:active`) : BAS mène à la ligne d'affiches au
 * plus proche, même depuis une pastille qu'aucune affiche ne couvre ; y
 * revenir remonte la page en haut.
 */

const BAR_REVEAL: FocusSectionReveal = { mode: "start" };

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
    <FocusGroup focusKey="filters" style={styles.bar}>
      <FocusSection focusKey="filters:pills" reveal={BAR_REVEAL} style={styles.pills}>
        {pills.map((pill) => (
          <FilterPill
            key={pill.key}
            pill={pill}
            focusKey={`pill:${pill.key}`}
            onPress={onPressPill ? () => onPressPill(pill.key) : undefined}
          />
        ))}
      </FocusSection>
      {active.length > 0 ? (
        <FocusSection focusKey="filters:active" reveal={BAR_REVEAL} style={styles.active}>
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
        </FocusSection>
      ) : null}
    </FocusGroup>
  );
});

const styles = StyleSheet.create({
  bar: { gap: 26 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  active: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  activeLabel: { ...fonts.semibold, fontSize: 22, color: colors.textTertiary, marginRight: 6 },
  divider: { width: 1, height: 34, marginHorizontal: 6, backgroundColor: colors.borderStrong },
});
