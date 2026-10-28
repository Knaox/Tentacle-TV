/**
 * Octave mobile — la liste d'un FILTRE (Titres, Albums, Artistes, Playlists),
 * virtualisée : titres en rangées de hauteur fixe, cartes en grille (2 colonnes
 * au téléphone, plus sur une tablette). La liste vient de l'extension qui la sert
 * seule (`useKindResults`), sinon de la page « Tout » déjà montrée.
 */

import { memo, useCallback, useMemo, type ReactElement } from "react";
import { FlatList, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react-native";
import { layoutSearch, type SearchFilter, type ShownExternalLists } from "@tentacle-tv/shared/octave";
import type { ExternalMusicPlaylist, MusicAlbum, MusicArtist, MusicPlaylist, MusicSearchResponse, MusicTrack } from "@tentacle-tv/shared/music";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { AlbumCard, ArtistCard, ExternalPlaylistCard, PlaylistCard } from "../ui/Cards";
import { TrackRow } from "../ui/TrackRow";
import { EmptyState, TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { playFrom } from "../env/playFrom";
import { clipsOffscreenCells } from "../../layout/listClipping";

type Cell =
  | { kind: "track"; track: MusicTrack; index: number }
  | { kind: "album"; album: MusicAlbum }
  | { kind: "artist"; artist: MusicArtist }
  | { kind: "playlist"; playlist: MusicPlaylist }
  | { kind: "external"; playlist: ExternalMusicPlaylist };

interface SearchKindListProps {
  query: string;
  filter: Exclude<SearchFilter, "all">;
  library: MusicSearchResponse | null;
  external: ShownExternalLists | null;
  pending: boolean;
  header: ReactElement;
  bottom: number;
}

const keyOf = (c: Cell) => (c.kind === "track" ? c.track.key : c.kind === "album" ? c.album.key : c.kind === "artist" ? c.artist.key : c.kind === "playlist" ? c.playlist.jellyfinId : c.playlist.key);

export const SearchKindList = memo(function SearchKindList({ query, filter, library, external, pending, header, bottom }: SearchKindListProps) {
  const { t } = useTranslation("music");
  const player = usePagesPlayer();
  const current = usePagesCurrentKey();
  const { gutter, isTablet, card, contentWidth: screen } = usePageMetrics();
  const layout = useMemo(() => layoutSearch(library, external ? { ...external, top: null } : null), [library, external]);
  const cells = useMemo<Cell[]>(() => {
    if (filter === "tracks") return layout.tracks.map((track, index) => ({ kind: "track", track, index }));
    if (filter === "albums") return layout.albums.map((album) => ({ kind: "album", album }));
    if (filter === "artists") return layout.artists.map((artist) => ({ kind: "artist", artist }));
    return [...layout.libraryPlaylists.map((playlist) => ({ kind: "playlist" as const, playlist })), ...layout.externalPlaylists.map((playlist) => ({ kind: "external" as const, playlist }))];
  }, [filter, layout]);
  const contextId = `search:${query}:tracks`;
  const play = useCallback((index: number) => playFrom(player, layout.tracks, index, contextId), [contextId, layout.tracks, player]);
  const grid = filter !== "tracks";
  const columns = grid ? (isTablet ? Math.max(3, Math.floor(700 / card)) : 2) : 1;
  // La largeur d'une cellule de la grille, ses 6 pt de marge de chaque côté ôtés.
  const width = grid ? Math.floor((screen - (gutter - 6) * 2) / columns - 12) : 0;
  const render = ({ item }: { item: Cell }) => {
    switch (item.kind) {
      case "track":
        return <TrackRow track={item.track} index={item.index} list={layout.tracks} contextId={contextId} playing={current === item.track.key} onPlay={play} gutter={gutter} />;
      case "album":
        return <View style={{ flex: 1 / columns, padding: 6 }}><AlbumCard album={item.album} width={width} /></View>;
      case "artist":
        return <View style={{ flex: 1 / columns, padding: 6 }}><ArtistCard artist={item.artist} width={width} /></View>;
      case "playlist":
        return <View style={{ flex: 1 / columns, padding: 6 }}><PlaylistCard playlist={item.playlist} width={width} /></View>;
      default:
        return <View style={{ flex: 1 / columns, padding: 6 }}><ExternalPlaylistCard playlist={item.playlist} width={width} /></View>;
    }
  };
  const empty = !pending && cells.length === 0 ? <EmptyState icon={SearchX} title={t("search.kindEmpty", { query })} /> : null;
  return (
    <FlatList
      key={`${filter}:${columns}`}
      data={cells}
      keyExtractor={keyOf}
      renderItem={render}
      numColumns={columns}
      columnWrapperStyle={grid ? { paddingHorizontal: gutter - 6 } : undefined}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={pending ? <TrackRowsSkeleton count={6} gutter={gutter} /> : null}
      contentContainerStyle={{ paddingBottom: bottom }}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
});
