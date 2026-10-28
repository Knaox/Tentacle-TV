/**
 * Octave mobile — les cartes d'étagère : album (pochette carrée, titre,
 * artistes ou année), artiste (portrait rond, nom), playlist (de la
 * bibliothèque ou d'une extension). Un toucher ouvre la page (un album hors
 * bibliothèque s'affiche aussitôt avec ce que la carte montrait :
 * `rememberAlbumPreview`) ; un appui maintenu lit la collection, quand on peut.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { rememberAlbumPreview } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import type { ExternalMusicPlaylist, MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { Artwork } from "./Artwork";

const artistsOf = (album: MusicAlbum) => album.artists.map((a) => a.name).join(", ");

function Caption({ title, subtitle, center }: { title: string; subtitle?: string | null; center?: boolean }) {
  const theme = useTheme();
  const align = center ? "center" : "left";
  return (
    <View style={styles.caption}>
      <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary, fontSize: 14, textAlign: align }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary, textAlign: align }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export const AlbumCard = memo(function AlbumCard({ album, width, onLongPress }: { album: MusicAlbum; width: number; onLongPress?: () => void }) {
  const nav = useOctaveNav();
  const open = () => {
    const target = entityTarget(album);
    if (target && !album.jellyfinId) rememberAlbumPreview(target, album);
    nav.album(album);
  };
  const subtitle = artistsOf(album) || (album.year ? String(album.year) : null);
  return (
    <PressableCard onPress={open} onLongPress={onLongPress} style={{ width }} accessibilityRole="button" accessibilityLabel={`${album.title}, ${subtitle ?? ""}`}>
      <Artwork url={album.artworkUrl} size={width} radius={10} />
      <Caption title={album.title} subtitle={subtitle} />
    </PressableCard>
  );
});

export const ArtistCard = memo(function ArtistCard({ artist, width }: { artist: MusicArtist; width: number }) {
  const nav = useOctaveNav();
  const { t } = useTranslation("music");
  return (
    <PressableCard onPress={() => nav.artist(artist)} style={{ width }} accessibilityRole="button" accessibilityLabel={artist.name}>
      <Artwork url={artist.imageUrl} size={width} round kind="artist" />
      <Caption title={artist.name} subtitle={t("search.kindArtist")} center />
    </PressableCard>
  );
});

export const PlaylistCard = memo(function PlaylistCard({ playlist, width }: { playlist: MusicPlaylist; width: number }) {
  const nav = useOctaveNav();
  const { t } = useTranslation("music");
  return (
    <PressableCard onPress={() => nav.playlist(playlist.jellyfinId)} style={{ width }} accessibilityRole="button" accessibilityLabel={playlist.name}>
      <Artwork url={playlist.artworkUrl} size={width} radius={10} />
      <Caption title={playlist.name} subtitle={t("count.tracks", { count: playlist.trackCount })} />
    </PressableCard>
  );
});

export const ExternalPlaylistCard = memo(function ExternalPlaylistCard({ playlist, width }: { playlist: ExternalMusicPlaylist; width: number }) {
  const nav = useOctaveNav();
  return (
    <PressableCard onPress={() => nav.externalPlaylist(playlist.key)} style={{ width }} accessibilityRole="button" accessibilityLabel={playlist.title}>
      <Artwork url={playlist.artworkUrl} size={width} radius={10} />
      <Caption title={playlist.title} subtitle={playlist.owner} />
    </PressableCard>
  );
});

const styles = StyleSheet.create({ caption: { marginTop: 8, gap: 2 } });
