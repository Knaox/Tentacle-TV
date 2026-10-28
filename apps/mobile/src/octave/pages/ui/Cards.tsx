/**
 * Octave mobile — les cartes d'étagère : album (pochette carrée, titre,
 * artistes ou année), artiste (portrait rond, nom), playlist (de la
 * bibliothèque ou d'une extension). Un toucher ouvre la page (un album hors
 * bibliothèque s'affiche aussitôt avec ce que la carte montrait :
 * `rememberAlbumPreview`) ; un appui maintenu lit la collection, quand on peut. Un album qui ne se LIT pas
 * (`isUnavailableAlbum` : absent de YouTube) est GRISÉ, dit « Pas lisible » sur sa pochette, et le toucher ouvre sa
 * feuille (aimer, ajouter à une playlist) au lieu de sa page.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff } from "lucide-react-native";
import { openUnavailableAlbum, useMusicPending } from "@tentacle-tv/api-client";
import { isUnavailableAlbum, playlistTrackTotal, rememberAlbumPreview } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import type { ExternalMusicPlaylist, MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { Artwork } from "./Artwork";

const artistsOf = (album: MusicAlbum) => album.artists.map((a) => a.name).join(", ");

function Caption({ title, subtitle, center, muted }: { title: string; subtitle?: string | null; center?: boolean; muted?: boolean }) {
  const theme = useTheme();
  const align = center ? "center" : "left";
  return (
    <View style={styles.caption}>
      <Text numberOfLines={1} style={[typography.bodyBold, { color: muted ? theme.colors.text.tertiary : theme.colors.text.primary, fontSize: 14, textAlign: align }]}>
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

/** « Pas lisible » : icône ET mot sur la pochette — jamais la seule couleur. */
function UnavailableBadge() {
  const { t } = useTranslation("music");
  return (
    <View style={styles.badge} pointerEvents="none">
      <CloudOff size={12} color="#fff" />
      <Text style={[typography.caption, styles.badgeText]} numberOfLines={1}>
        {t("unavailableAlbum.badge")}
      </Text>
    </View>
  );
}

export const AlbumCard = memo(function AlbumCard({ album, width, onLongPress }: { album: MusicAlbum; width: number; onLongPress?: () => void }) {
  const nav = useOctaveNav();
  const { t } = useTranslation("music");
  const unavailable = isUnavailableAlbum(album);
  const subtitle = artistsOf(album) || (album.year ? String(album.year) : null);
  if (unavailable) {
    return (
      <PressableCard onPress={() => openUnavailableAlbum(album)} style={{ width }} accessibilityRole="button" accessibilityLabel={t("unavailableAlbum.cardLabel", { title: album.title })}>
        <View>
          <View style={styles.dimmed}>
            <Artwork url={album.artworkUrl} size={width} radius={10} />
          </View>
          <UnavailableBadge />
        </View>
        <Caption title={album.title} subtitle={subtitle} muted />
      </PressableCard>
    );
  }
  const open = () => {
    const target = entityTarget(album);
    if (target && !album.jellyfinId) rememberAlbumPreview(target, album);
    nav.album(album);
  };
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
  // Les ajouts hors bibliothèque en attente comptent, comme sur la page de la playlist.
  const count = playlistTrackTotal(playlist.trackCount, useMusicPending(useOctavePagesProvider()).data.items, playlist.jellyfinId);
  return (
    <PressableCard onPress={() => nav.playlist(playlist.jellyfinId)} style={{ width }} accessibilityRole="button" accessibilityLabel={playlist.name}>
      <Artwork url={playlist.artworkUrl} size={width} radius={10} />
      <Caption title={playlist.name} subtitle={t("count.tracks", { count })} />
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

const styles = StyleSheet.create({
  caption: { marginTop: 8, gap: 2 },
  // La pochette d'un album qu'on n'écoute pas : estompée (React Native n'a pas de niveaux de gris sans filtre natif).
  dimmed: { opacity: 0.45 },
  badge: { position: "absolute", left: 6, top: 6, flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
