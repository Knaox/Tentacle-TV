import { useTranslation } from "react-i18next";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, RotateCcw } from "lucide-react";
import { LibraryActiveFilterPills } from "../LibraryActiveFilterPills";
import { GenreMenu, PlatformMenu, RatingMenu, SortMenu, YearMenu } from "./LibraryFilterMenus";
import { WatchStatusSegment } from "./WatchStatusSegment";
import { HeartIcon, chipCls } from "./filterChip";
import type { LibraryFilterBarProps } from "./filterBarTypes";

/**
 * La barre d'outils de la page Bibliothèque : UN panneau, deux étages.
 *
 * En haut, « où je cherche » — le champ, le compte de titres, le tri et son
 * sens. En bas, « ce que je garde » — le statut de visionnage en contrôle
 * segmenté, les favoris, puis un menu ancré par critère. Ce qui est posé se
 * rappelle dessous, en pastilles qu'on retire d'un clic.
 *
 * Le panneau est un aplat, pas un verre : il chevauche le bas de la bannière
 * et descend avec la page, un `backdrop-filter` y serait recalculé à chaque
 * image du défilement pour un flou que l'aplat masquerait de toute façon.
 * La matière vient d'un lavis de marque en tête et d'un filet dégradé
 * violet → rose sur l'arête haute.
 */
export function LibraryToolbarPanel(props: LibraryFilterBarProps) {
  const { t } = useTranslation(["common", "library"]);
  const { filters } = props;
  const clearGenres = () => filters.genreIds.forEach(props.onToggleGenre);
  const clearPlatforms = () => filters.platformIds.forEach(props.onTogglePlatform);
  const desc = filters.sortOrder === "Descending";
  const narrowed = props.hasActiveFilters;

  return (
    <>
      <section
        aria-label={t("library:toolbar")}
        className="relative rounded-[var(--radius-xl)] p-2.5 shadow-[var(--elev-2)] ring-1 ring-line-subtle md:p-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(var(--brand-rgb),0.07), rgba(var(--brand-rgb),0) 60%), var(--surface-1)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(var(--brand-rgb),0.7), rgba(var(--brand-accent-rgb),0.7), transparent)",
          }}
        />

        {/* `justify-between` et non `ml-auto` : sur le téléviseur, la passe qui
            émule `gap` pose une marge sur chaque enfant et écrase `ml-auto` —
            le groupe de droite finissait au milieu de la barre. */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
          {/* Avec des actions au bout (Ma liste, Mes favoris), l'étage haut est
              plus long : le champ garde toute la ligne jusqu'au grand écran,
              sinon il n'y montrait plus que « Rechercher d… » à 800 px. */}
          {props.leading && (
            <div className={`w-full min-w-0 ${props.actions ? "xl:w-auto xl:max-w-xl xl:flex-1" : "md:w-auto md:max-w-xl md:flex-1"}`}>
              {props.leading}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ResultCount loading={props.resultsLoading} total={props.totalResults} narrowed={narrowed} />
            <SortMenu
              toolbar
              filters={filters}
              onSortByChange={props.onSortByChange}
              onSortOrderChange={props.onSortOrderChange}
            />
            <button
              type="button"
              onClick={() => props.onSortOrderChange(desc ? "Ascending" : "Descending")}
              aria-label={desc ? t("library:orderDescending") : t("library:orderAscending")}
              title={t("library:reverseOrder")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-2)] text-content-secondary shadow-[var(--elev-1)] ring-1 ring-line-strong transition-colors hover:bg-fill-medium hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
            >
              {desc
                ? <ArrowDownWideNarrow aria-hidden className="h-4 w-4" strokeWidth={2.1} />
                : <ArrowUpNarrowWide aria-hidden className="h-4 w-4" strokeWidth={2.1} />}
            </button>
            {props.actions && (
              <>
                <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-fill-soft sm:block" />
                {props.actions}
              </>
            )}
          </div>
        </div>

        <div aria-hidden className="my-2.5 border-t border-line-subtle md:my-3" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {props.segment}
            {!props.segment && (props.showStatus ?? true) && (
              <WatchStatusSegment
                statusFilter={filters.statusFilter}
                isFavorite={filters.isFavorite}
                onStatusChange={props.onStatusChange}
                onFavoriteChange={props.onFavoriteChange}
              />
            )}
            {(props.showFavorite ?? true) && (
              <button
                type="button"
                onClick={() => { props.onFavoriteChange(!filters.isFavorite); if (!filters.isFavorite) props.onStatusChange(null); }}
                aria-selected={filters.isFavorite}
                className={`${chipCls(filters.isFavorite, "rose")} inline-flex items-center gap-1.5`}
              >
                <HeartIcon filled={filters.isFavorite} />
                {t("common:favorites")}
              </button>
            )}

            <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-fill-soft sm:block" />

            <GenreMenu genres={props.genres} filters={filters} onToggleGenre={props.onToggleGenre} onClear={clearGenres} />
            <YearMenu
              filters={filters}
              onYearFromChange={props.onYearFromChange}
              onYearToChange={props.onYearToChange}
              onClear={props.onClearYears}
            />
            <RatingMenu filters={filters} onRatingMinChange={props.onRatingMinChange} onClear={props.onClearRating} />
            <PlatformMenu filters={filters} onTogglePlatform={props.onTogglePlatform} onClear={clearPlatforms} />
          </div>

          {narrowed && (
            <button
              type="button"
              onClick={props.onReset}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
            >
              <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t("common:resetFilters")}
            </button>
          )}
        </div>
      </section>

      <LibraryActiveFilterPills
        compact
        genres={props.genres}
        filters={filters}
        hasActiveFilters={props.hasActiveFilters}
        totalResults={undefined}
        onRemoveGenre={props.onToggleGenre}
        onClearPlatform={props.onTogglePlatform}
        onClearYears={props.onClearYears}
        onClearRating={props.onClearRating}
        onReset={props.onReset}
      />
    </>
  );
}

/**
 * Le compte, toujours visible : « 1 284 titres » quand rien ne filtre,
 * « 37 résultats » dès qu'un filtre ou une recherche resserre. Chiffres
 * tabulaires — le nombre change sous les yeux, la barre ne doit pas bouger.
 */
function ResultCount({ loading, total, narrowed }: { loading?: boolean; total: number | undefined; narrowed: boolean }) {
  const { t } = useTranslation(["common", "library"]);
  if (loading) return <span aria-hidden className="skeleton-shimmer block h-3 w-16 rounded-full" />;
  if (total == null) return null;
  return (
    <p aria-live="polite" className="whitespace-nowrap text-xs font-medium tabular-nums text-content-tertiary">
      {narrowed ? t("common:resultCount", { count: total }) : t("library:titles", { count: total })}
    </p>
  );
}
