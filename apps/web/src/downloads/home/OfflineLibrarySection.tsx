import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DownloadListEntry, OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import { RowHeader } from "../../components/rows/RowHeader";
import { RevealCell, RevealScope } from "../../components/grid/RevealCell";
import { ScopedSearchField } from "../../components/search/ScopedSearchField";
import { SheetSegments } from "../ui/SheetSegments";
import { ALL_LIBRARIES, type OfflineHomeFilter, type OfflineHomeLibrary } from "./useOfflineHome";
import { OfflineMovieTile, OfflineSeriesTile } from "./OfflineLibraryTiles";

/**
 * Hauteur réservée à une cellule d'affiche avant son premier passage — affiche
 * 2:3 plus son bloc titre. Elle ne décide que du premier positionnement de la
 * barre de défilement : une cellule montée garde sa hauteur réelle.
 */
const POSTER_CELL_HEIGHT = 260;
/** Titre, sous-titre, et la ligne « Reprendre S1 · E3 » d'une série entamée. */
const POSTER_TEXT_HEIGHT = 70;
/** Cellules montées d'emblée, pour qu'aucune case ne soit vide au premier rendu. */
const EAGER_CELLS = 14;
const GRID = "grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  filter: OfflineHomeFilter;
  onFilter: (value: OfflineHomeFilter) => void;
  libraries: readonly OfflineHomeLibrary[];
  movies: readonly DownloadListEntry[];
  series: readonly OfflineSeriesGroup[];
}

/**
 * Tout ce que la machine porte, en GRILLES — un catalogue fini se cherche et
 * se filtre en entier, une rangée cacherait ce qui dépasse. La recherche et
 * les puces (bibliothèque d'origine : Films, Séries, Animés…) filtrent sur
 * place, sans rien déplacer au-dessus : le champ ne saute pas sous le curseur.
 *
 * Chaque affiche décodée pèse ~540 Ko : un seul observateur pour les deux
 * grilles, les cellules gardent leur place et démontent leur contenu hors champ.
 */
export function OfflineLibrarySection({ search, onSearch, filter, onFilter, libraries, movies, series }: Props) {
  const { t } = useTranslation(["downloads", "common"]);
  const empty = movies.length === 0 && series.length === 0;

  return (
    <section>
      <div className="row-gutter flex flex-wrap items-center justify-between gap-3">
        <ScopedSearchField
          value={search}
          onChange={onSearch}
          placeholder={t("downloads:offlineSearchPlaceholder")}
          className="w-full sm:w-80"
        />
        {/* Une seule bibliothèque : la puce « Tout » n'arbitrerait rien. */}
        {libraries.length > 1 && (
          <SheetSegments
            label={t("downloads:filterAll")}
            value={filter}
            onChange={onFilter}
            options={[{ id: ALL_LIBRARIES, label: t("downloads:filterAll"), count: null as number | null }, ...libraries].map((option) => ({
              value: option.id,
              label: (
                <>
                  {option.label}
                  {option.count !== null && <span className="num ml-1.5 text-xs font-medium text-content-tertiary">{option.count}</span>}
                </>
              ),
            }))}
          />
        )}
      </div>

      {empty ? (
        <div className="row-gutter mt-12 flex flex-col items-center text-center">
          <p className="text-sm font-medium text-content-secondary">{t("common:noResults")}</p>
          <p className="mt-1 text-[13px] text-content-tertiary">{t("common:noResultsHint")}</p>
        </div>
      ) : (
        <RevealScope>
          <div className="mt-8 space-y-12">
            {movies.length > 0 && (
              <Grid title={t("downloads:sectionMovies")} count={movies.length}>
                {movies.map((movie, i) => (
                  <RevealCell key={movie.id} minHeight={POSTER_CELL_HEIGHT} aspect={2 / 3} textHeight={POSTER_TEXT_HEIGHT} eager={i < EAGER_CELLS}>
                    <OfflineMovieTile entry={movie} />
                  </RevealCell>
                ))}
              </Grid>
            )}
            {series.length > 0 && (
              <Grid title={t("downloads:sectionSeries")} count={series.length}>
                {series.map((group, i) => (
                  <RevealCell key={group.key} minHeight={POSTER_CELL_HEIGHT} aspect={2 / 3} textHeight={POSTER_TEXT_HEIGHT} eager={i < EAGER_CELLS}>
                    <OfflineSeriesTile group={group} />
                  </RevealCell>
                ))}
              </Grid>
            )}
          </div>
        </RevealScope>
      )}
    </section>
  );
}

function Grid({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="group/row">
      <RowHeader title={title} trailing={<span className="num text-sm font-medium text-content-tertiary">{count}</span>} />
      <div className={`row-gutter mt-5 ${GRID}`}>{children}</div>
    </div>
  );
}
