/**
 * Octave — les résultats MONTRÉS d'une recherche validée (`useRevealedResults`) :
 * les TITRES d'abord — ceux de la bibliothèque, puis ceux de l'extension —,
 * ensuite artistes, albums et playlists. Rien ne se réordonne une fois montré ;
 * une extension en retard garde sa place (rangées fantômes) au lieu de pousser
 * la page en arrivant.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlbumCard, ArtistCard, CardGrid, PlaylistCard, Shelf } from "../components/Cards";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, RowsSkeleton } from "../components/ViewStates";
import type { useRevealedResults } from "./useRevealedResults";

type Revealed = ReturnType<typeof useRevealedResults>;

const EXTERNAL_TRACKS = 10;
const LIBRARY_TRACKS = 8;

export const SearchResults = memo(function SearchResults({ results }: { results: Revealed }) {
  const { t } = useTranslation("music");
  const { library, external, externalLabel, externalPending } = results;
  const data = library?.data ?? null;
  const query = library?.query ?? "";
  const libraryRows = useMemo(() => rowsOf((data?.tracks ?? []).slice(0, LIBRARY_TRACKS)), [data]);
  const externalRows = useMemo(() => rowsOf((external?.tracks ?? []).slice(0, EXTERNAL_TRACKS)), [external]);
  if (!library) return null;

  const libraryEmpty = !data || (!data.tracks.length && !data.albums.length && !data.artists.length && !data.playlists.length);
  const externalEmpty = !external || (!external.tracks.length && !external.albums.length && !external.artists.length);
  const nothing = libraryEmpty && !externalPending && externalEmpty && (external?.complete ?? true);
  const label = externalLabel ?? t("search.externalDefault");

  return (
    <div className="flex flex-col gap-8">
      {nothing && (
        <EmptyState>
          <span className="block">{t("search.nothingFound", { query })}</span>
          <span className="mt-1 block text-content-tertiary">{t("search.nothingFoundHint")}</span>
        </EmptyState>
      )}
      {libraryRows.length > 0 && (
        <Shelf title={t("search.tracks")}>
          <TrackList rows={libraryRows} contextId={`search:${query}`} showArtwork showAlbum label={t("search.tracks")} />
        </Shelf>
      )}
      {externalRows.length > 0 && (
        <Shelf title={label}>
          <TrackList rows={externalRows} contextId={`search:external:${query}`} showArtwork showAlbum label={label} />
        </Shelf>
      )}
      {externalPending && (
        <Shelf title={label}>
          <RowsSkeleton rows={5} />
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
      {(external?.albums.length ?? 0) > 0 && (
        <Shelf title={t("search.albums")} action={<span className="text-xs text-content-tertiary">{label}</span>}>
          <CardGrid>{external?.albums.slice(0, 12).map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid>
        </Shelf>
      )}
      {(external?.artists.length ?? 0) > 0 && (
        <Shelf title={t("search.artists")} action={<span className="text-xs text-content-tertiary">{label}</span>}>
          <CardGrid>{external?.artists.slice(0, 6).map((a) => <ArtistCard key={a.key} artist={a} />)}</CardGrid>
        </Shelf>
      )}
    </div>
  );
});
