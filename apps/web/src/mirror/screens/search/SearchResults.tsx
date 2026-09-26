import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownRight, Globe, Info, Loader, PenLine, type LucideIcon } from "lucide-react";
import type { ExternalSearchState } from "@tentacle-tv/api-client";
import {
  foldForSearch,
  type ExternalSearchItem,
  type SearchMediaItem,
  type SearchPersonHit,
  type SearchProvider,
  type SearchResponse,
} from "@tentacle-tv/shared";
import { EpisodeList } from "./SearchEpisodes";
import { ExternalSections } from "./SearchExternal";
import type { SearchFilter } from "./SearchFilters";
import { FacetChips, PeopleRail } from "./SearchPeople";
import { PosterGrid, PosterRail, Section } from "./SearchSection";
import { TopResultCard } from "./TopResultCard";

export interface SearchActions {
  openItem: (id: string) => void;
  playItem: (id: string) => void;
  openPerson: (person: SearchPersonHit) => void;
  openFacet: (kind: "genre" | "studio", name: string) => void;
  openExternalItem: (provider: SearchProvider, item: ExternalSearchItem) => void;
  openExternal: (provider: SearchProvider, href: string) => void;
}

interface Props {
  query: string;
  response: SearchResponse | undefined;
  episodes: SearchMediaItem[];
  external: ExternalSearchState;
  filter: SearchFilter;
  onFilter: (filter: SearchFilter) => void;
  /** Relancer avec la bonne orthographe proposée. */
  onRetry: (query: string) => void;
  actions: SearchActions;
}

const PREVIEW = 10;

/** La correction à dire — sauf si, une fois pliée, elle ne change rien. */
export function effectiveCorrection(response: SearchResponse | undefined, query: string): string | null {
  const correction = response?.correction;
  return correction && foldForSearch(correction) !== foldForSearch(query) ? correction : null;
}

/** Rien dans la bibliothèque : ni meilleur résultat, ni catégorie, ni épisode. */
export function isLibraryEmpty(r: SearchResponse | undefined, episodeCount: number): boolean {
  return !!r && r.top === null && r.movies.length === 0 && r.series.length === 0
    && r.collections.length === 0 && r.people.length === 0 && episodeCount === 0;
}

/**
 * `SearchResults` de l'app. « Tout » : le meilleur résultat, un aperçu de
 * chaque catégorie en rail (« Tout voir » ouvre le filtre), les personnes, 4
 * épisodes, les collections, genres et studios, puis les extensions. Un
 * filtre : la catégorie entière, en grille. Une faute corrigée se dit ; rien
 * trouvé propose la bonne orthographe au lieu d'une impasse.
 */
export const SearchResults = memo(function SearchResults({ query, response, episodes, external, filter, onFilter, onRetry, actions }: Props) {
  const { t } = useTranslation("search");
  const r = response;
  const noLibrary = isLibraryEmpty(r, episodes.length);
  const correction = effectiveCorrection(r, query);

  return (
    <div className="pb-5">
      {r && !r.ready && <Notice icon={Loader} text={t("indexing")} />}
      {correction && !noLibrary && <Notice icon={PenLine} text={`${t("resultsFor")} « ${correction} »`} />}
      {r?.partial && !noLibrary && <Notice icon={Info} text={t("partial")} />}

      {noLibrary && (
        <div className="flex flex-col items-start gap-1.5 px-4 pt-5">
          <p className="text-lg font-bold text-content-primary">{t("noResults", { query })}</p>
          <p className="text-sm leading-5 text-content-tertiary">{t("noResultsHint")}</p>
          {correction && (
            <button
              type="button"
              onClick={() => onRetry(correction)}
              className="mt-2 flex min-h-10 items-center gap-2 rounded-full border px-3.5 active:opacity-70"
              style={{ background: "var(--brand-soft)", borderColor: "var(--brand-glow)" }}
            >
              <CornerDownRight size={15} className="text-brand-light" aria-hidden />
              <span className="text-sm font-semibold text-brand-light">{`${t("resultsFor")} « ${correction} »`}</span>
            </button>
          )}
        </div>
      )}

      {r && filter === "all" && (
        <>
          {r.top && <TopResultCard top={r.top} onOpen={actions.openItem} onPlay={actions.playItem} onPerson={actions.openPerson} />}
          {r.movies.length > 0 && (
            <Section title={t("movies")} count={r.totals.movies} onSeeAll={r.totals.movies > PREVIEW ? () => onFilter("movies") : undefined}>
              <PosterRail hits={r.movies.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.series.length > 0 && (
            <Section title={t("series")} count={r.totals.series} onSeeAll={r.totals.series > PREVIEW ? () => onFilter("series") : undefined}>
              <PosterRail hits={r.series.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.people.length > 0 && (
            <Section title={t("people")} count={r.totals.people}>
              <PeopleRail people={r.people} onOpen={actions.openPerson} />
            </Section>
          )}
          {episodes.length > 0 && (
            <Section title={t("episodes")} onSeeAll={episodes.length > 4 ? () => onFilter("episodes") : undefined}>
              <EpisodeList episodes={episodes.slice(0, 4)} onOpen={actions.openItem} />
            </Section>
          )}
          {r.collections.length > 0 && (
            <Section title={t("collections")} count={r.totals.collections}>
              <PosterRail hits={r.collections.slice(0, PREVIEW)} onOpen={actions.openItem} />
            </Section>
          )}
          {(r.genres.length > 0 || r.studios.length > 0) && (
            <Section title={t("facets")}>
              <FacetChips genres={r.genres} studios={r.studios} onOpen={actions.openFacet} />
            </Section>
          )}
        </>
      )}

      {r && filter === "movies" && <Section title={t("movies")} count={r.totals.movies}><PosterGrid hits={r.movies} onOpen={actions.openItem} /></Section>}
      {r && filter === "series" && <Section title={t("series")} count={r.totals.series}><PosterGrid hits={r.series} onOpen={actions.openItem} /></Section>}
      {r && filter === "collections" && (
        <Section title={t("collections")} count={r.totals.collections}><PosterGrid hits={r.collections} onOpen={actions.openItem} /></Section>
      )}
      {r && filter === "people" && (
        <Section title={t("people")} count={r.totals.people}>
          <PeopleRail people={r.people} onOpen={actions.openPerson} />
        </Section>
      )}
      {filter === "episodes" && <Section title={t("episodes")}><EpisodeList episodes={episodes} onOpen={actions.openItem} /></Section>}

      {(filter === "all" || noLibrary) && external.results.length > 0 && (
        <ExternalSections results={external.results} onOpen={actions.openExternalItem} onSeeAll={actions.openExternal} />
      )}
      {(filter === "all" || noLibrary) && external.pending && external.results.length === 0 && (
        <Notice icon={Globe} text={t("externalSearching")} />
      )}
    </div>
  );
});

/** Une ligne d'information discrète au-dessus des résultats : icône 14, texte 13 tertiaire. */
function Notice({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 px-4 text-[13px] font-medium text-content-tertiary">
      <Icon size={14} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{text}</span>
    </p>
  );
}
