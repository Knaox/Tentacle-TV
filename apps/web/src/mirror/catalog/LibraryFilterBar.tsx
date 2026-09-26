import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGenres } from "@tentacle-tv/api-client";
import { PLATFORMS } from "@tentacle-tv/shared";
import { SORT_OPTIONS, STATUS_OPTIONS, yearChipLabel } from "./catalogOptions";
import { ActiveFilterChips, type ActiveChip } from "./FilterChip";
import type { LibraryCatalogState } from "./useLibraryCatalogState";

/**
 * Sous la recherche d'un catalogue (`screens/library/LibraryFilterBar` de
 * l'app) : ce qui le filtre, en pastilles qu'on retire d'un toucher — et
 * SEULEMENT quand il y en a —, puis « N résultats » (13 medium tertiaire,
 * marges 16, 4 au-dessus, 8 dessous). Les réglages vivent dans la feuille.
 */
export const LibraryFilterBar = memo(function LibraryFilterBar({ state, showCount = true }: {
  state: LibraryCatalogState;
  showCount?: boolean;
}) {
  const { t } = useTranslation("common");
  const { data: genres } = useGenres(state.libraryId);
  const { advancedFilters: f, advanced, sortIndex, statusFilter, selectedGenres, setSortIndex, setStatusFilter } = state;

  const chips = useMemo<ActiveChip[]>(() => {
    const status = STATUS_OPTIONS.find((o) => o.value !== null && o.value === statusFilter);
    return [
      ...(sortIndex !== 0 ? [{ key: "sort", label: t(SORT_OPTIONS[sortIndex].labelKey), remove: () => setSortIndex(0) }] : []),
      ...(status ? [{ key: "status", label: t(status.labelKey), remove: () => setStatusFilter(null) }] : []),
      ...selectedGenres.map((id) => ({
        key: `g-${id}`, label: genres?.find((g) => g.Id === id)?.Name ?? id, remove: () => advanced.onToggleGenre(id),
      })),
      ...f.platformIds.map((id) => ({
        key: `p-${id}`, label: PLATFORMS.find((p) => p.id === id)?.name ?? String(id), remove: () => advanced.onTogglePlatform(id),
      })),
      ...(f.yearFrom != null || f.yearTo != null
        ? [{
            key: "years",
            label: yearChipLabel(f.yearFrom, f.yearTo),
            remove: () => {
              advanced.onYearFromChange(null);
              advanced.onYearToChange(null);
            },
          }]
        : []),
      ...(f.ratingMin != null ? [{ key: "rating", label: `≥ ${f.ratingMin}/10`, remove: () => advanced.onRatingMinChange(null) }] : []),
      ...(f.isFavorite ? [{ key: "fav", label: `♥ ${t("favorites")}`, remove: () => advanced.onFavoriteChange(false) }] : []),
    ];
  }, [t, sortIndex, statusFilter, selectedGenres, genres, f, advanced, setSortIndex, setStatusFilter]);

  return (
    <div>
      <ActiveFilterChips chips={chips} onReset={advanced.onReset} className="py-1" />
      {showCount && !state.catalog.isLoading && (
        <p className="px-4 pb-2 pt-1 text-[13px] font-medium tracking-[-0.075px] text-content-tertiary">
          {t("resultCount", { count: state.totalCount })}
        </p>
      )}
    </div>
  );
});
