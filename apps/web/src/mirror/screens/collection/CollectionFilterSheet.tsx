import { useTranslation } from "react-i18next";
import { COLLECTION_SORTS, FilterChip, FilterSection, FilterSheetFrame, STATUS_OPTIONS } from "../../catalog";
import type { CollectionFiltersApi } from "./useCollectionFilters";

/**
 * « Trier et filtrer » Ma liste et Mes favoris (`collection/CollectionFilterSheet`
 * de l'app), paliers 66 / 95 % : le tri (quatre, en mémoire), l'état de
 * visionnage et les genres tirés des titres chargés. Chaque geste s'applique
 * aussitôt ; le pied dit combien de titres on va voir.
 */
export function CollectionFilterSheet({ open, onClose, filters }: {
  open: boolean;
  onClose: () => void;
  filters: CollectionFiltersApi;
}) {
  const { t } = useTranslation("common");
  const { state, patch } = filters;
  const toggleGenre = (id: string) =>
    patch({ genres: state.genres.includes(id) ? state.genres.filter((g) => g !== id) : [...state.genres, id] });

  return (
    <FilterSheetFrame
      open={open}
      onClose={onClose}
      snapPoints={[0.66, 0.95]}
      activeCount={filters.activeCount}
      onReset={filters.reset}
      footLabel={t("showResultsCount", { count: filters.resultCount })}
    >
      <FilterSection title={t("sortBy")}>
        {COLLECTION_SORTS.map((sort) => (
          <FilterChip
            key={sort.key}
            label={t(sort.key)}
            active={state.sortBy === sort.sortBy}
            onPress={() => patch({ sortBy: sort.sortBy, sortOrder: sort.sortOrder })}
          />
        ))}
      </FilterSection>
      <FilterSection title={t("watchStatus")}>
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.labelKey}
            label={t(opt.labelKey)}
            active={state.statusFilter === opt.value}
            onPress={() => patch({ statusFilter: opt.value })}
          />
        ))}
      </FilterSection>
      {filters.genres.length > 0 && (
        <FilterSection title={t("genres")}>
          <FilterChip label={t("allFilter")} active={state.genres.length === 0} onPress={() => patch({ genres: [] })} />
          {filters.genres.map((genre) => (
            <FilterChip
              key={genre.Id}
              label={genre.Name}
              active={state.genres.includes(genre.Id)}
              onPress={() => toggleGenre(genre.Id)}
            />
          ))}
        </FilterSection>
      )}
    </FilterSheetFrame>
  );
}
