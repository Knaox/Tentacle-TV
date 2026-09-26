import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { PLATFORMS } from "@tentacle-tv/shared";
import { RATING_STEPS, SORT_OPTIONS, STATUS_OPTIONS } from "./catalogOptions";
import { FilterChip, FilterSection } from "./FilterChip";
import { FilterSheetFrame } from "./FilterSheetFrame";
import { YearPicker } from "./YearPicker";
import type { LibraryCatalogState } from "./useLibraryCatalogState";

/**
 * « Trier et filtrer » un catalogue (`catalog/CatalogFilterSheet` de l'app),
 * paliers 85 / 95 % : le tri, l'état de visionnage, les genres, les
 * plateformes, les années (De — À), la note minimale et les favoris. Chaque
 * geste s'applique aussitôt ; le pied dit combien de titres on va voir.
 */
export const CatalogFilterSheet = memo(function CatalogFilterSheet({ state }: { state: LibraryCatalogState }) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(state.libraryId);
  const { advancedFilters: f, advanced } = state;
  const close = () => state.setSheetOpen(false);
  const resultCount = state.catalog.isLoading ? null : state.totalCount;

  return (
    <FilterSheetFrame
      open={state.sheetOpen}
      onClose={close}
      snapPoints={[0.85, 0.95]}
      activeCount={state.filterCount}
      onReset={advanced.onReset}
      footLabel={resultCount == null ? t("sortAndFilter") : t("showResultsCount", { count: resultCount })}
    >
      <FilterSection title={t("sortBy")}>
        {SORT_OPTIONS.map((opt, i) => (
          <FilterChip key={opt.labelKey} label={t(opt.labelKey)} active={state.sortIndex === i} onPress={() => state.setSortIndex(i)} />
        ))}
      </FilterSection>

      <FilterSection title={t("watchStatus")}>
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.labelKey}
            label={t(opt.labelKey)}
            active={state.statusFilter === opt.value}
            onPress={() => state.setStatusFilter(opt.value)}
          />
        ))}
      </FilterSection>

      {genres && genres.length > 0 && (
        <FilterSection title={t("genres")}>
          <FilterChip label={t("allFilter")} active={state.selectedGenres.length === 0} onPress={advanced.onClearGenres} />
          {genres.map((g) => (
            <FilterChip key={g.Id} label={g.Name} active={state.selectedGenres.includes(g.Id)} onPress={() => advanced.onToggleGenre(g.Id)} />
          ))}
        </FilterSection>
      )}

      <FilterSection title={t("platforms")}>
        {PLATFORMS.map((p) => (
          <FilterChip key={p.id} label={p.name} active={f.platformIds.includes(p.id)} onPress={() => advanced.onTogglePlatform(p.id)} />
        ))}
      </FilterSection>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.8px] text-content-tertiary">{t("sortYear")}</h3>
        <div className="flex items-end gap-2">
          <YearPicker label={t("yearFrom")} value={f.yearFrom} onChange={advanced.onYearFromChange} />
          <span className="mb-3 text-[15px] text-content-quaternary">—</span>
          <YearPicker label={t("yearTo")} value={f.yearTo} onChange={advanced.onYearToChange} />
        </div>
      </section>

      <FilterSection title={t("ratingMin")}>
        {RATING_STEPS.map((r) => (
          <FilterChip
            key={r ?? "any"}
            label={r == null ? t("ratingAny") : `≥ ${r}/10`}
            active={f.ratingMin === r}
            onPress={() => advanced.onRatingMinChange(r)}
          />
        ))}
      </FilterSection>

      <FilterSection title={t("favorites")}>
        <FilterChip label={t("allFilter")} active={!f.isFavorite} onPress={() => advanced.onFavoriteChange(false)} />
        <FilterChip label={`♥ ${t("favorites")}`} active={f.isFavorite} onPress={() => advanced.onFavoriteChange(true)} />
      </FilterSection>
    </FilterSheetFrame>
  );
});
