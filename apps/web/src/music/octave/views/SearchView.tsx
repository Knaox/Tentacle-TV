/**
 * Octave — la recherche. La BIBLIOTHÈQUE d'abord (au fil de la frappe), puis
 * la section de l'extension musique, remplie page après page — elle n'existe
 * pas sans extension. La requête vit dans l'adresse (`?q=`) : retour arrière
 * et lien profond la retrouvent.
 */

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PluginMusicSearchState } from "@tentacle-tv/api-client";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard, Shelf } from "../components/Cards";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, RowsSkeleton } from "../components/ViewStates";
import { useOctaveSearch } from "../search/useOctaveSearch";

function ExternalResults({ section, label, query }: { section: PluginMusicSearchState; label: string; query: string }) {
  const { t } = useTranslation("music");
  const rows = useMemo(() => rowsOf(section.tracks.slice(0, 10)), [section.tracks]);
  const empty = section.tracks.length === 0 && section.albums.length === 0 && section.artists.length === 0;
  if (empty && section.complete && !section.pending) return null;
  return (
    <Shelf title={label} action={!section.complete ? <span className="text-xs text-content-tertiary" role="status">{t("search.externalLoading")}</span> : undefined}>
      {/* Une barre fine pendant que des pages arrivent : jamais un spinner qui bloque. */}
      {!section.complete && (
        <div aria-hidden className="mx-2 h-0.5 overflow-hidden rounded-full bg-fill-subtle">
          <div className="h-full w-1/4 animate-loading-bar rounded-full bg-brand" />
        </div>
      )}
      {rows.length > 0 && (
        <div className="octave-enter">
          <TrackList rows={rows} contextId={`search:external:${query}`} showArtwork showAlbum label={label} />
        </div>
      )}
      {section.albums.length > 0 && (
        <div className="octave-enter">
          <CardGrid>
            {section.albums.slice(0, 12).map((a) => (
              <AlbumCard key={a.key} album={a} />
            ))}
          </CardGrid>
        </div>
      )}
      {section.artists.length > 0 && (
        <div className="octave-enter">
          <CardGrid>
            {section.artists.slice(0, 6).map((a) => (
              <ArtistCard key={a.key} artist={a} />
            ))}
          </CardGrid>
        </div>
      )}
    </Shelf>
  );
}

export function SearchView() {
  const { t } = useTranslation("music");
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const { library, external, externalLabel } = useOctaveSearch(query);
  const data = library.data;
  const trackRows = useMemo(() => rowsOf((data?.tracks ?? []).slice(0, 8)), [data]);
  const libraryEmpty = !!data && !data.tracks.length && !data.albums.length && !data.artists.length && !data.playlists.length;

  const setQuery = (value: string) => setParams(value ? { q: value } : {}, { replace: true });

  return (
    <div className="flex flex-col gap-8 px-2 pb-10 pt-6 md:px-6">
      <div className="sticky top-0 z-10 -mx-2 bg-surface-0 px-2 pb-2 pt-1 md:-mx-6 md:px-6">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-content-tertiary" aria-hidden />
          <label htmlFor="octave-search" className="sr-only">
            {t("search.title")}
          </label>
          <input
            id="octave-search"
            type="search"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="h-12 w-full rounded-full border border-line-subtle bg-fill-subtle pl-12 pr-12 text-base text-content-primary placeholder:text-content-quaternary focus:border-line-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("search.clear")}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!query.trim() && (
        <div className="px-2 py-10">
          <h1 className="text-2xl font-bold text-content-primary">{t("search.emptyTitle")}</h1>
          <p className="mt-2 text-sm text-content-tertiary">{t("search.emptyHint")}</p>
        </div>
      )}

      {query.trim() && !data && library.pending && <RowsSkeleton rows={5} />}
      {libraryEmpty && <EmptyState>{t("search.noResults", { query: query.trim() })}</EmptyState>}

      {trackRows.length > 0 && (
        <Shelf title={t("search.tracks")}>
          <TrackList rows={trackRows} contextId={`search:${library.settledQuery}`} showArtwork showAlbum label={t("search.tracks")} />
        </Shelf>
      )}
      {(data?.artists.length ?? 0) > 0 && (
        <Shelf title={t("search.artists")}>
          <CardGrid>{data?.artists.slice(0, 6).map((a) => <ArtistCard key={a.key} artist={a} />)}</CardGrid>
        </Shelf>
      )}
      {(data?.albums.length ?? 0) > 0 && (
        <Shelf title={t("search.albums")}>
          <CardGrid>{data?.albums.slice(0, 12).map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid>
        </Shelf>
      )}
      {(data?.playlists.length ?? 0) > 0 && (
        <Shelf title={t("search.playlists")}>
          <CardGrid>{data?.playlists.slice(0, 6).map((p) => <PlaylistCard key={p.jellyfinId} playlist={p} />)}</CardGrid>
        </Shelf>
      )}

      {external.available && externalLabel && <ExternalResults section={external} label={externalLabel} query={query} />}
    </div>
  );
}
