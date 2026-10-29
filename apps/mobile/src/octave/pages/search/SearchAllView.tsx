/**
 * Octave mobile — la vue « Tout » d'une recherche, comme le bureau : le MEILLEUR
 * RÉSULTAT en grande carte et ses titres à lire d'un geste, puis albums,
 * artistes et playlists en étagères. Une extension en retard garde sa place
 * (rangées fantômes) au lieu de pousser la page ; rien ne se réordonne une fois
 * montré (`layoutSearch` sur ce que `useRevealedResults` a révélé).
 */

import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { searchAlbumOwnership, type AlbumOwnership } from "@tentacle-tv/api-client";
import { useTopPlayback } from "./topPlayback";
import type { SearchFilter, SearchLayout } from "@tentacle-tv/shared/octave";
import type { ExternalMusicPlaylist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { AlbumCard, ArtistCard, ExternalPlaylistCard, PlaylistCard } from "../ui/Cards";
import { SectionTitle, Shelf, albumSelf } from "../ui/Shelf";
import { TrackList } from "../ui/TrackList";
import { TrackRowsSkeleton } from "../ui/ViewStates";
import { usePageMetrics } from "../ui/pageStyle";
import { TopResultCard } from "./TopResultCard";

const TRACKS_WITHOUT_TOP = 8;
const ALBUMS_SHOWN = 12;
const ARTISTS_SHOWN = 8;

type AnyPlaylist = { lib: MusicPlaylist } | { ext: ExternalMusicPlaylist };

interface SearchAllViewProps {
  query: string;
  layout: SearchLayout;
  /** Ce que la bibliothèque a des albums d'ailleurs (pastille, jamais grisé s'il y est en partie), comme le bureau. */
  albumOwnership: ReadonlyMap<string, AlbumOwnership>;
  externalPending: boolean;
  onFilter: (filter: SearchFilter) => void;
}

export const SearchAllView = memo(function SearchAllView({ query, layout, albumOwnership, externalPending, onFilter }: SearchAllViewProps) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const { gutter, sectionGap } = usePageMetrics();
  const contextId = `search:${query}`;
  const top = layout.top;
  // La règle du bureau : un album lit l'album, une playlist la playlist (`topPlayback.ts`).
  const playTop = useTopPlayback(layout.sideTracks, `${contextId}:top`);
  const tracks = top ? layout.sideTracks : layout.tracks.slice(0, TRACKS_WITHOUT_TOP);
  const more = top ? layout.tracks.length > layout.sideTracks.length : layout.tracks.length > TRACKS_WITHOUT_TOP;
  const seeAll = (filter: SearchFilter) => (
    <Pressable onPress={() => onFilter(filter)} hitSlop={10} accessibilityRole="button">
      <Text style={[typography.caption, { color: theme.colors.text.secondary, fontWeight: "600" }]}>{t("search.seeAll")}</Text>
    </Pressable>
  );
  const playlists: AnyPlaylist[] = [...layout.libraryPlaylists.map((lib) => ({ lib })), ...layout.externalPlaylists.map((ext) => ({ ext }))];
  return (
    <View style={{ gap: sectionGap }}>
      {top ? (
        <View style={{ paddingHorizontal: gutter }}>
          <TopResultCard top={top} onPlay={() => playTop(top)} />
        </View>
      ) : null}
      {tracks.length > 0 ? (
        <View>
          <SectionTitle title={t("search.tracks")} action={more ? seeAll("tracks") : undefined} />
          <TrackList tracks={tracks} contextId={top ? `${contextId}:side` : contextId} gutter={gutter} />
        </View>
      ) : null}
      {externalPending ? (
        <View>
          <SectionTitle title={t("search.externalLoading")} />
          <TrackRowsSkeleton count={4} gutter={gutter} />
        </View>
      ) : null}
      <Shelf title={t("search.albums")} items={layout.albums.slice(0, ALBUMS_SHOWN)} keyOf={(a) => a.key} albumOf={albumSelf} render={(album, w) => <AlbumCard album={album} ownership={searchAlbumOwnership(album, albumOwnership)} width={w} />} onSeeAll={layout.albums.length > ALBUMS_SHOWN ? () => onFilter("albums") : undefined} />
      <Shelf title={t("search.artists")} items={layout.artists.slice(0, ARTISTS_SHOWN)} keyOf={(a) => a.key} render={(artist, w) => <ArtistCard artist={artist} width={w} />} onSeeAll={layout.artists.length > ARTISTS_SHOWN ? () => onFilter("artists") : undefined} />
      <Shelf
        title={t("search.playlists")}
        items={playlists}
        keyOf={(p) => ("lib" in p ? p.lib.jellyfinId : p.ext.key)}
        render={(p, w) => ("lib" in p ? <PlaylistCard playlist={p.lib} width={w} /> : <ExternalPlaylistCard playlist={p.ext} width={w} />)}
      />
    </View>
  );
});
