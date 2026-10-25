/**
 * Octave — la vue « Tout » d'une recherche (façon Apple Music) : le MEILLEUR RÉSULTAT en grande carte, les titres
 * à lire d'un geste à côté, puis les albums, les artistes et les playlists. Une extension en retard garde sa place
 * (rangées fantômes) au lieu de pousser la page en arrivant ; rien ne se réordonne une fois montré.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard, Shelf } from "../components/Cards";
import { TrackList, rowsOf } from "../components/TrackList";
import { RowsSkeleton } from "../components/ViewStates";
import { ExternalPlaylistCard } from "./ExternalPlaylistCard";
import type { SearchFilter, SearchLayout } from "./searchLayout";
import { TopResultCard } from "./TopResultCard";
import { useTopPlayback } from "./useTopPlayback";

const TRACKS_WITHOUT_TOP = 8;
const ALBUMS_SHOWN = 12;
const ARTISTS_SHOWN = 6;
const PLAYLISTS_SHOWN = 6;

interface SearchAllViewProps {
  query: string;
  layout: SearchLayout;
  /** L'extension tarde : sa place est réservée sous les titres. */
  externalPending: boolean;
  onFilter: (filter: SearchFilter) => void;
}

function SeeAll({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("music");
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-md px-1 text-sm font-medium text-content-tertiary transition-colors duration-150 hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
      {t("search.seeAll")}
    </button>
  );
}

export const SearchAllView = memo(function SearchAllView({ query, layout, externalPending, onFilter }: SearchAllViewProps) {
  const { t } = useTranslation("music");
  const contextId = `search:${query}`;
  const top = layout.top;
  const { play, warm } = useTopPlayback(layout.sideTracks, `${contextId}:top`);
  const sideRows = useMemo(() => rowsOf(layout.sideTracks), [layout.sideTracks]);
  const trackRows = useMemo(() => rowsOf(layout.tracks.slice(0, TRACKS_WITHOUT_TOP)), [layout.tracks]);
  const playlistCount = layout.libraryPlaylists.length + layout.externalPlaylists.length;
  const moreTracks = (top ? layout.tracks.length > layout.sideTracks.length : layout.tracks.length > TRACKS_WITHOUT_TOP) ? <SeeAll onClick={() => onFilter("tracks")} /> : undefined;

  return (
    <>
      {top ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <TopResultCard top={top} onPlay={play} onWarm={warm} />
          {sideRows.length > 0 && (
            <Shelf title={t("search.tracks")} action={moreTracks}>
              <TrackList rows={sideRows} contextId={`${contextId}:side`} showArtwork label={t("search.tracks")} />
            </Shelf>
          )}
        </div>
      ) : (
        trackRows.length > 0 && (
          <Shelf title={t("search.tracks")} action={moreTracks}>
            <TrackList rows={trackRows} contextId={contextId} showArtwork showAlbum label={t("search.tracks")} />
          </Shelf>
        )
      )}
      {externalPending && (
        <Shelf title={t("search.externalLoading")}>
          <RowsSkeleton rows={5} />
        </Shelf>
      )}
      {layout.albums.length > 0 && (
        <Shelf title={t("search.albums")} action={layout.albums.length > ALBUMS_SHOWN ? <SeeAll onClick={() => onFilter("albums")} /> : undefined}>
          <CardGrid>{layout.albums.slice(0, ALBUMS_SHOWN).map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid>
        </Shelf>
      )}
      {layout.artists.length > 0 && (
        <Shelf title={t("search.artists")} action={layout.artists.length > ARTISTS_SHOWN ? <SeeAll onClick={() => onFilter("artists")} /> : undefined}>
          <CardGrid>{layout.artists.slice(0, ARTISTS_SHOWN).map((a) => <ArtistCard key={a.key} artist={a} />)}</CardGrid>
        </Shelf>
      )}
      {playlistCount > 0 && (
        <Shelf title={t("search.playlists")} action={playlistCount > PLAYLISTS_SHOWN ? <SeeAll onClick={() => onFilter("playlists")} /> : undefined}>
          <CardGrid>
            {layout.libraryPlaylists.slice(0, PLAYLISTS_SHOWN).map((p) => <PlaylistCard key={p.jellyfinId} playlist={p} />)}
            {layout.externalPlaylists.slice(0, Math.max(0, PLAYLISTS_SHOWN - layout.libraryPlaylists.length)).map((p) => <ExternalPlaylistCard key={p.key} playlist={p} />)}
          </CardGrid>
        </Shelf>
      )}
    </>
  );
});
