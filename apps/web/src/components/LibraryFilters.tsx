import { useTranslation } from "react-i18next";
import { LibraryActiveFilterPills } from "./LibraryActiveFilterPills";
import {
  GenreMenu,
  PlatformMenu,
  RatingMenu,
  SortMenu,
  YearMenu,
} from "./library/LibraryFilterMenus";
import type { LibraryFilterState } from "../hooks/useLibraryFilters";

/**
 * Style commun à tous les chips de la barre de filtre (statut, favoris, filtres
 * avancés, genres), partagé avec `FilterMenu` — cf. `CHIP_BASE` exporté.
 *
 * Fond OPAQUE (`--surface-2`), et c'est un changement de fond, pas de goût.
 * Ces pastilles reposent SUR la bannière de la bibliothèque : un `bg-fill-subtle`
 * translucide et un `ring-line-subtle` s'y perdaient entièrement dès que
 * l'affiche est claire — en thème clair, sur une image d'animé pastel,
 * « Non vus » et « En cours » devenaient carrément illisibles. Un contrôle doit
 * se lire avant d'être survolé, quelle que soit l'image derrière.
 *
 * L'état actif garde sa teinte de marque, posée en dégradé PAR-DESSUS l'aplat
 * opaque : superposer les deux préserve le repère colorimétrique sans revenir à
 * une transparence qui dépend de l'affiche.
 *
 * `backdrop-blur` retiré : il n'y a plus rien à voir au travers, et il coûtait
 * une passe de compositing par pastille, huit fois par barre.
 */
export const CHIP_BASE = "rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
const CHIP_IDLE =
  "bg-[color:var(--surface-2)] text-content-secondary ring-1 ring-line-strong shadow-[var(--elev-1)] hover:bg-fill-medium hover:text-content-primary";

function chipCls(active: boolean, accent: "violet" | "rose" = "violet"): string {
  if (!active) return `${CHIP_BASE} ${CHIP_IDLE}`;
  if (accent === "rose") {
    return `${CHIP_BASE} bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-accent-rgb),0.22),rgba(var(--brand-accent-rgb),0.22))] text-[var(--brand-accent-light)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.55)]`;
  }
  return `${CHIP_BASE} bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.24),rgba(var(--brand-rgb),0.24))] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.6)]`;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7.5-4.5-9.5-9.2C1 8.2 3.2 5 6.5 5c2 0 3.6 1.1 4.5 2.4 1-1.3 2.5-2.4 4.5-2.4 3.3 0 5.5 3.2 4 6.8C19.5 16.5 12 21 12 21z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

/* ── Quick filter bar + advanced panel trigger ────── */

const STATUS_QUICK = [
  { value: null, key: "allFilter" },
  { value: "IsUnplayed", key: "unwatched" },
  { value: "IsResumable", key: "inProgress" },
] as const;

interface LibraryFilterBarProps {
  libraryId: string;
  filters: LibraryFilterState;
  activeCount: number;
  hasActiveFilters: boolean;
  totalResults: number | undefined;
  onToggleGenre: (id: string) => void;
  onTogglePlatform: (id: number) => void;
  onStatusChange: (v: string | null) => void;
  onYearFromChange: (v: number | null) => void;
  onYearToChange: (v: number | null) => void;
  onRatingMinChange: (v: number | null) => void;
  onFavoriteChange: (v: boolean) => void;
  onSortByChange: (v: string) => void;
  onSortOrderChange: (v: string) => void;
  onReset: () => void;
  onClearYears: () => void;
  onClearRating: () => void;
}

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
        <button
          onClick={() => { props.onFavoriteChange(!props.filters.isFavorite); if (!props.filters.isFavorite) props.onStatusChange(null); }}
          aria-selected={props.filters.isFavorite}
          className={`${chipCls(props.filters.isFavorite, "rose")} inline-flex items-center gap-1.5`}
        >
          <HeartIcon filled={props.filters.isFavorite} />
          {t("common:favorites")}
        </button>

        <div className="mx-1 h-5 w-px bg-fill-soft" />

        <SortMenu
          filters={props.filters}
          onSortByChange={props.onSortByChange}
          onSortOrderChange={props.onSortOrderChange}
        />
        <GenreMenu
          libraryId={props.libraryId}
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
        libraryId={props.libraryId}
        filters={props.filters}
        hasActiveFilters={props.hasActiveFilters}
        totalResults={props.totalResults}
        onRemoveGenre={props.onToggleGenre}
        onClearPlatform={(id) => props.onTogglePlatform(id)}
        onClearYears={props.onClearYears}
        onClearRating={props.onClearRating}
        onReset={props.onReset}
      />
    </>
  );
}
