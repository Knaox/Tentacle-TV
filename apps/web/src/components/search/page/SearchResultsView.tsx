/**
 * Les résultats d'une requête sur la page : le meilleur résultat en tête,
 * puis une section par type (« Tout »), ou la grille complète d'un seul type.
 * Mêmes réponses du moteur que l'omnibox, plus larges.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchMediaItem, SearchPersonHit, SearchResponse } from "@tentacle-tv/shared";
import { TopResultHero } from "./TopResultHero";
import { EpisodeList, FacetChips, PeopleStrip, PosterGrid, Section } from "./SearchSections";
import type { SearchTab } from "./searchParams";
import { ExternalSections } from "../external/ExternalSections";
import type { ExternalSearchState } from "../external/useExternalSearch";

interface SearchResultsViewProps {
  response: SearchResponse;
  episodes: readonly SearchMediaItem[];
  /** Ce que les plugins trouvent hors bibliothèque. */
  external: ExternalSearchState;
  tab: SearchTab;
  terms: readonly string[];
  onTab: (tab: SearchTab) => void;
  onOpenPath: (path: string) => void;
  onOpenItem: (item: SearchMediaItem) => void;
  onOpenPerson: (person: SearchPersonHit) => void;
  onOpenFacet: (kind: "genre" | "studio", name: string) => void;
  onRetry: (query: string) => void;
}

/** Les éléments d'un type, meilleur résultat compris quand il en est. */
function withTop(response: SearchResponse, list: SearchResponse["movies"], type: string): SearchMediaItem[] {
  const top = response.top?.kind === "item" && response.top.hit.item.Type === type ? [response.top.hit.item] : [];
  return [...top, ...list.map((hit) => hit.item)];
}

export const SearchResultsView = memo(function SearchResultsView(props: SearchResultsViewProps) {
  const { response, episodes, external, tab, terms, onTab, onOpenPath, onOpenItem, onOpenPerson, onOpenFacet, onRetry } = props;
  const { t } = useTranslation("search");
  const movies = withTop(response, response.movies, "Movie");
  const series = withTop(response, response.series, "Series");
  const collections = withTop(response, response.collections, "BoxSet");
  const people = [...(response.top?.kind === "person" ? [response.top.hit] : []), ...response.people];
  const nothing = response.top === null && movies.length + series.length + collections.length + people.length + episodes.length === 0;
  // Ce que la bibliothèque a déjà : les plugins ne le proposent pas une seconde fois.
  const owned = useMemo(
    () => [...withTop(response, response.movies, "Movie"), ...withTop(response, response.series, "Series")]
      .map((item) => ({ name: item.Name, year: item.ProductionYear ?? null })),
    [response],
  );
  const beyond = external.results.length > 0 || external.pending;

  if (nothing) {
    return (
      <div className="px-4 md:px-12">
        <div className={`text-center ${beyond ? "pb-2 pt-10" : "py-20"}`} role="status">
          <p className="text-xl font-semibold text-content-primary">
            {t(beyond ? "noLibraryResults" : "noResults", { query: response.query })}
          </p>
          {!beyond && <p className="mx-auto mt-3 max-w-md text-sm text-content-tertiary">{t("noResultsHint")}</p>}
          {response.correction !== null && (
            <button type="button" onClick={() => onRetry(response.correction ?? "")} className="mt-6 rounded-full bg-[var(--brand-soft)] px-5 py-2 text-sm font-semibold text-[var(--brand-light)]">
              {response.correction}
            </button>
          )}
        </div>
        <ExternalSections external={external} library={owned} />
      </div>
    );
  }

  const notice = (
    <div className="flex flex-col gap-1 text-sm text-content-tertiary">
      {response.correction !== null && (
        <p>
          {t("resultsFor")} <span className="font-semibold italic text-[var(--brand-light)]">{response.correction}</span>
        </p>
      )}
      {response.partial && <p>{t("partial")}</p>}
      {!response.ready && <p>{t("indexing")}</p>}
    </div>
  );

  if (tab !== "all") {
    return (
      <div className="px-4 pt-6 md:px-12">
        {notice}
        {tab === "movies" && <div className="mt-4"><PosterGrid items={movies} onOpen={onOpenItem} /></div>}
        {tab === "series" && <div className="mt-4"><PosterGrid items={series} onOpen={onOpenItem} /></div>}
        {(tab === "movies" || tab === "series") && (
          <ExternalSections external={external} library={owned} kind={tab === "movies" ? "movie" : "series"} />
        )}
        {tab === "collections" && <div className="mt-4"><PosterGrid items={collections} onOpen={onOpenItem} /></div>}
        {tab === "people" && <div className="mt-4"><PeopleStrip people={people} terms={terms} onOpen={onOpenPerson} /></div>}
        {tab === "episodes" && <div className="mt-4"><EpisodeList episodes={episodes} terms={terms} onOpen={onOpenItem} /></div>}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 md:px-12">
      {notice}
      {response.top !== null && (
        <div className="mt-4">
          <TopResultHero top={response.top} terms={terms} onOpen={onOpenPath} />
        </div>
      )}
      {(response.genres.length > 0 || response.studios.length > 0) && (
        <div className="mt-6">
          <FacetChips genres={response.genres} studios={response.studios} onOpen={onOpenFacet} />
        </div>
      )}
      {response.movies.length > 0 && (
        <Section title={t("movies")} count={response.totals.movies} onSeeAll={() => onTab("movies")}>
          <PosterGrid items={response.movies.map((h) => h.item)} onOpen={onOpenItem} />
        </Section>
      )}
      {response.series.length > 0 && (
        <Section title={t("series")} count={response.totals.series} onSeeAll={() => onTab("series")}>
          <PosterGrid items={response.series.map((h) => h.item)} onOpen={onOpenItem} />
        </Section>
      )}
      {response.people.length > 0 && (
        <Section title={t("people")} count={response.totals.people} onSeeAll={() => onTab("people")}>
          <PeopleStrip people={response.people} terms={terms} onOpen={onOpenPerson} />
        </Section>
      )}
      {response.collections.length > 0 && (
        <Section title={t("collections")} count={response.totals.collections}>
          <PosterGrid items={response.collections.map((h) => h.item)} onOpen={onOpenItem} />
        </Section>
      )}
      {episodes.length > 0 && (
        <Section title={t("episodes")} onSeeAll={() => onTab("episodes")}>
          <EpisodeList episodes={episodes.slice(0, 6)} terms={terms} onOpen={onOpenItem} />
        </Section>
      )}
      <ExternalSections external={external} library={owned} limit={12} />
    </div>
  );
});
