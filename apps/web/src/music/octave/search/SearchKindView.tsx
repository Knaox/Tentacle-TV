/**
 * Octave — la vue d'un FILTRE de recherche : une seule liste, entière — les titres de la bibliothèque d'abord, puis
 * ceux de l'extension sans leurs jumeaux (`searchLayout`) ; ou les albums, les artistes, les playlists en grille.
 * Tant que la liste de l'extension n'est pas montrable, sa place est réservée (aucun saut à l'arrivée).
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicSearchResponse } from "@tentacle-tv/shared/music";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard } from "../components/Cards";
import { TrackList, rowsOf } from "../components/TrackList";
import { CardsSkeleton, EmptyState, RowsSkeleton } from "../components/ViewStates";
import { searchAlbumOwnership, type AlbumOwnership } from "../library/ownedItems";
import { ExternalPlaylistCard } from "./ExternalPlaylistCard";
import { layoutSearch, type SearchFilter, type ShownExternalLists } from "./searchLayout";

interface SearchKindViewProps {
  query: string;
  filter: Exclude<SearchFilter, "all">;
  library: MusicSearchResponse | null;
  external: ShownExternalLists | null;
  /** Les albums que la bibliothèque a (en entier ou en partie), par clé de carte. */
  albumOwnership: ReadonlyMap<string, AlbumOwnership>;
  pending: boolean;
}

export const SearchKindView = memo(function SearchKindView({ query, filter, library, external, albumOwnership, pending }: SearchKindViewProps) {
  const { t } = useTranslation("music");
  const layout = useMemo(() => layoutSearch(library, external ? { ...external, top: null } : null), [library, external]);
  const rows = useMemo(() => rowsOf(layout.tracks), [layout.tracks]);
  const label = t(`search.${filter}`);
  const count = filter === "tracks" ? layout.tracks.length : filter === "albums" ? layout.albums.length : filter === "artists" ? layout.artists.length : layout.libraryPlaylists.length + layout.externalPlaylists.length;
  if (count === 0 && !pending) {
    return (
      <EmptyState>
        <span className="block">{t("search.kindEmpty", { query })}</span>
      </EmptyState>
    );
  }
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      {filter === "tracks" && rows.length > 0 && <TrackList rows={rows} contextId={`search:${query}:tracks`} showArtwork showAlbum markLibrary label={label} />}
      {filter === "albums" && layout.albums.length > 0 && <CardGrid>{layout.albums.map((a) => <AlbumCard key={a.key} album={a} ownership={searchAlbumOwnership(a, albumOwnership)} />)}</CardGrid>}
      {filter === "artists" && layout.artists.length > 0 && <CardGrid>{layout.artists.map((a) => <ArtistCard key={a.key} artist={a} />)}</CardGrid>}
      {filter === "playlists" && (
        <CardGrid>
          {layout.libraryPlaylists.map((p) => <PlaylistCard key={p.jellyfinId} playlist={p} />)}
          {layout.externalPlaylists.map((p) => <ExternalPlaylistCard key={p.key} playlist={p} />)}
        </CardGrid>
      )}
      {pending && (filter === "tracks" ? <RowsSkeleton rows={8} /> : <CardsSkeleton count={6} />)}
    </section>
  );
});
