import { useTranslation } from "react-i18next";
import { LibraryActiveFilterPills } from "./LibraryActiveFilterPills";
import {
  GenreMenu,
  PlatformMenu,
  RatingMenu,
  SortMenu,
  YearMenu,
} from "./library/LibraryFilterMenus";
import { LibraryToolbarPanel } from "./library/LibraryToolbarPanel";
import { HeartIcon, STATUS_QUICK, chipCls } from "./library/filterChip";
import type { LibraryFilterBarProps } from "./library/filterBarTypes";

// Le style des pastilles vit dans `library/filterChip` ; `CHIP_BASE` reste
// exporté d'ici, la cible webOS le relit depuis ce module.
export { CHIP_BASE } from "./library/filterChip";

/**
 * Barre de filtres : statuts en pastilles, puis un menu ancré par critère.
 *
 * Remplace le duo « mur de pastilles de genres + panneau latéral plein
 * écran » : sur une bibliothèque d'animés, la bande de genres comptait plus de
 * cent pastilles à faire défiler horizontalement, et le panneau avancé
 * masquait la grille pendant tout le réglage. Ici chaque menu se referme sur
 * la grille — on voit l'effet du filtre au moment où on le pose.
 */
export function LibraryFilterBar(props: LibraryFilterBarProps) {
  const { t } = useTranslation("common");
  if (props.variant === "panel") return <LibraryToolbarPanel {...props} />;
  const clearGenres = () => props.filters.genreIds.forEach(props.onToggleGenre);
  const clearPlatforms = () => props.filters.platformIds.forEach(props.onTogglePlatform);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_QUICK.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { props.onStatusChange(opt.value); props.onFavoriteChange(false); }}
            // L'état actif ne se lisait que dans la teinte de la pastille : un
            // lecteur d'écran ne pouvait pas dire quel filtre était posé.
            aria-selected={props.filters.statusFilter === opt.value && !props.filters.isFavorite}
            className={chipCls(
              props.filters.statusFilter === opt.value && !props.filters.isFavorite,
            )}
          >
            {t(`common:${opt.key}`)}
          </button>
        ))}
        {(props.showFavorite ?? true) && (
          <button
            onClick={() => { props.onFavoriteChange(!props.filters.isFavorite); if (!props.filters.isFavorite) props.onStatusChange(null); }}
            aria-selected={props.filters.isFavorite}
            className={`${chipCls(props.filters.isFavorite, "rose")} inline-flex items-center gap-1.5`}
          >
            <HeartIcon filled={props.filters.isFavorite} />
            {t("common:favorites")}
          </button>
        )}

        <div className="mx-1 h-5 w-px bg-fill-soft" />

        <SortMenu
          filters={props.filters}
          onSortByChange={props.onSortByChange}
          onSortOrderChange={props.onSortOrderChange}
        />
        <GenreMenu
          genres={props.genres}
          filters={props.filters}
          onToggleGenre={props.onToggleGenre}
          onClear={clearGenres}
        />
        <YearMenu
          filters={props.filters}
          onYearFromChange={props.onYearFromChange}
          onYearToChange={props.onYearToChange}
          onClear={props.onClearYears}
        />
        <RatingMenu
          filters={props.filters}
          onRatingMinChange={props.onRatingMinChange}
          onClear={props.onClearRating}
        />
        <PlatformMenu
          filters={props.filters}
          onTogglePlatform={props.onTogglePlatform}
          onClear={clearPlatforms}
        />

        {props.hasActiveFilters && (
          <button
            onClick={props.onReset}
            className="ml-1 text-xs font-medium text-content-tertiary underline-offset-4 transition-colors hover:text-content-primary hover:underline"
          >
            {t("common:resetFilters")}
          </button>
        )}
      </div>

      {/* Rappel des filtres posés + compte de résultats. Les pastilles de menu
          portent déjà leur propre valeur : cette ligne ne sert plus qu'au
          total, et disparaît quand rien n'est filtré. */}
      <LibraryActiveFilterPills
        genres={props.genres}
        filters={props.filters}
        hasActiveFilters={props.hasActiveFilters}
        totalResults={props.totalResults}
        onRemoveGenre={props.onToggleGenre}
        onClearPlatform={(id) => props.onTogglePlatform(id)}
        onClearYears={props.onClearYears}
        onClearRating={props.onClearRating}
        onClearStatus={() => props.onStatusChange(null)}
        onClearFavorite={() => props.onFavoriteChange(false)}
        onReset={props.onReset}
      />
    </>
  );
}
