import { useTranslation } from "react-i18next";
import { SortDescendingIcon } from "@phosphor-icons/react/dist/csr/SortDescending";
import { SortAscendingIcon } from "@phosphor-icons/react/dist/csr/SortAscending";
import { LibraryActiveFilterPills } from "../LibraryActiveFilterPills";
import { GenreMenu, PlatformMenu, RatingMenu, SortMenu, YearMenu } from "./LibraryFilterMenus";
import { LanguageMenus } from "./LanguageMenus";
import { WatchStatusSegment } from "./WatchStatusSegment";
import { HeartIcon, chipCls } from "./filterChip";
import type { LibraryFilterBarProps } from "./filterBarTypes";

/**
 * La barre d'outils de la page Bibliothèque (et de Ma liste, Mes favoris) : UN panneau, trois
 * étages, du plus large au plus précis.
 *
 *  1. « où je cherche » — le champ, puis à droite le compte de titres, le tri et son sens, et
 *     les gestes de la page (sélection, partage, grille ou liste) ;
 *  2. « ce que je garde » — le statut de visionnage en contrôle segmenté, les favoris, puis un
 *     menu par critère (genres, années, note, plateformes, langues) ;
 *  3. « ce qui est posé » — CHAQUE filtre actif en puce qu'on retire d'un clic, et « Tout
 *     effacer ». Absent tant que rien ne filtre.
 *
 * Le panneau est l'encre 1 du socle (`.ui-panel`), opaque : il chevauche le bas de la bannière
 * et descend avec la page — un `backdrop-filter` y serait recalculé à chaque image du
 * défilement. Plus de lavis ni de filet de marque : la couleur est aux affiches. Sous le verre
 * natif, `lg-content lg-content-frosted` en fait le panneau givré (`theme/paneContent.css`).
 */
export function LibraryToolbarPanel(props: LibraryFilterBarProps) {
  const { t } = useTranslation(["common", "library"]);
  const { filters } = props;
  const clearGenres = () => filters.genreIds.forEach(props.onToggleGenre);
  const clearPlatforms = () => filters.platformIds.forEach(props.onTogglePlatform);
  const desc = filters.sortOrder === "Descending";
  const narrowed = props.hasActiveFilters;
  // Statut et favoris ne se rappellent en puce que là où la barre les propose : Ma liste a ses
  // étapes à la place du statut, Mes favoris n'a pas de filtre « Favoris ».
  const statusShown = (props.showStatus ?? true) && !props.segment;
  const favoriteShown = props.showFavorite ?? true;
  const recalled = {
    ...filters,
    statusFilter: statusShown ? filters.statusFilter : null,
    isFavorite: favoriteShown && filters.isFavorite,
  };

  return (
    <section aria-label={t("library:toolbar")} className="lg-content lg-content-frosted ui-panel relative p-3 md:p-4">
      {/* `justify-between` et non `ml-auto` : sur le téléviseur, la passe qui
          émule `gap` pose une marge sur chaque enfant et écrase `ml-auto` —
          le groupe de droite finissait au milieu de la barre. */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 md:gap-3">
        {/* Avec des actions au bout (Ma liste, Mes favoris), l'étage haut est
            plus long : le champ garde toute la ligne jusqu'au grand écran,
            sinon il n'y montrait plus que « Rechercher d… » à 800 px. */}
        {props.leading && (
          <div className={`w-full min-w-0 ${props.actions ? "xl:w-auto xl:max-w-md xl:flex-1" : "md:w-auto md:max-w-md md:flex-1"}`}>
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
            className="lg-content-control icon-btn btn-sm btn-soft"
          >
            {desc ? <SortDescendingIcon size={16} aria-hidden /> : <SortAscendingIcon size={16} aria-hidden />}
          </button>
          {props.actions && (
            <>
              <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-line-subtle sm:block" />
              {props.actions}
            </>
          )}
        </div>
      </div>

      <div aria-hidden className="my-3 border-t border-line-subtle" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {props.segment}
          {statusShown && (
            <WatchStatusSegment
              statusFilter={filters.statusFilter}
              isFavorite={filters.isFavorite}
              onStatusChange={props.onStatusChange}
              onFavoriteChange={props.onFavoriteChange}
            />
          )}
          {favoriteShown && (
            <button
              type="button"
              onClick={() => { props.onFavoriteChange(!filters.isFavorite); if (!filters.isFavorite) props.onStatusChange(null); }}
              aria-selected={filters.isFavorite}
              className={chipCls(filters.isFavorite, "rose")}
            >
              <HeartIcon filled={filters.isFavorite} />
              {t("common:favorites")}
            </button>
          )}

          <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-line-subtle sm:block" />

          <GenreMenu genres={props.genres} filters={filters} onToggleGenre={props.onToggleGenre} onClear={clearGenres} />
          <YearMenu
            filters={filters}
            onYearFromChange={props.onYearFromChange}
            onYearToChange={props.onYearToChange}
            onClear={props.onClearYears}
          />
          <RatingMenu filters={filters} onRatingMinChange={props.onRatingMinChange} onClear={props.onClearRating} />
          <PlatformMenu filters={filters} onTogglePlatform={props.onTogglePlatform} onClear={clearPlatforms} />
          <LanguageMenus
            languages={props.languages}
            filters={filters}
            onAudioLangChange={props.onAudioLangChange}
            onSubtitleLangChange={props.onSubtitleLangChange}
          />
        </div>
      </div>

      {/* Ce qui est posé, un par un — statut et favoris compris : on lit d'un regard pourquoi
          la grille est plus courte, et chaque puce se retire seule. */}
      <LibraryActiveFilterPills
        genres={props.genres}
        filters={recalled}
        hasActiveFilters={props.hasActiveFilters}
        totalResults={undefined}
        languages
        className="mt-3 border-t border-line-subtle pt-3"
        onRemoveGenre={props.onToggleGenre}
        onClearPlatform={props.onTogglePlatform}
        onClearYears={props.onClearYears}
        onClearRating={props.onClearRating}
        onClearStatus={() => props.onStatusChange(null)}
        onClearFavorite={() => props.onFavoriteChange(false)}
        onClearAudioLang={props.onAudioLangChange ? () => props.onAudioLangChange?.(null) : undefined}
        onClearSubtitleLang={props.onSubtitleLangChange ? () => props.onSubtitleLangChange?.(null) : undefined}
        onReset={props.onReset}
      />
    </section>
  );
}

/**
 * Le compte, toujours visible : « 1 284 titres » quand rien ne filtre,
 * « 37 résultats » dès qu'un filtre ou une recherche resserre. Chiffres
 * tabulaires — le nombre change sous les yeux, la barre ne doit pas bouger.
 */
function ResultCount({ loading, total, narrowed }: { loading?: boolean; total: number | undefined; narrowed: boolean }) {
  const { t } = useTranslation(["common", "library"]);
  if (loading) return <span aria-hidden className="skeleton-shimmer block h-3.5 w-20 rounded-full" />;
  if (total == null) return null;
  return (
    <p aria-live="polite" className="whitespace-nowrap px-1 text-[13px] font-semibold tabular-nums text-content-secondary">
      {narrowed ? t("common:resultCount", { count: total }) : t("library:titles", { count: total })}
    </p>
  );
}
