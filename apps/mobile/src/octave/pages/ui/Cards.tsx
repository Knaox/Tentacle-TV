/**
 * Octave mobile — les cartes d'étagère : album (pochette carrée, titre,
 * artistes ou année), artiste (portrait rond, nom), playlist (de la
 * bibliothèque ou d'une extension). Un toucher ouvre la page (un album hors
 * bibliothèque s'affiche aussitôt avec ce que la carte montrait :
 * `rememberAlbumPreview`) ; un appui maintenu lit la collection, quand on peut. Un album qui ne se LIT pas
 * (`isUnavailableAlbum` : absent de YouTube) est GRISÉ, dit « Pas lisible » sur sa pochette, et le toucher ouvre sa
 * feuille (aimer, ajouter à une playlist) au lieu de sa page. Une sortie IMPORTÉE porte « Importé » au coin. Un album
 * d'ailleurs que la bibliothèque a (`ownership`, comme le bureau) porte « Dans la bibliothèque » ou « En partie » — et
 * un album en partie présent n'est jamais grisé.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CloudOff, Library } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { openUnavailableAlbum, prefetchExternalEntity, useMusicPending, type AlbumOwnership } from "@tentacle-tv/api-client";
import { isUnavailableAlbum, playlistTrackTotal, rememberAlbumPreview } from "@tentacle-tv/shared/octave";
import { entityTarget } from "@tentacle-tv/shared/octave/mode";
import type { ExternalMusicPlaylist, MusicAlbum, MusicArtist, MusicPlaylist } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { Artwork } from "./Artwork";
import { ImportedBadge } from "../../releases/ImportedBadge";

/** La vue d'un album ou d'un artiste hors bibliothèque demandée au toucher, avant la navigation. */
export function useOpenWarmup() {
  const qc = useQueryClient();
  const provider = useOctavePagesProvider();
  return (kind: "album" | "artist", target: string) => void prefetchExternalEntity(qc, provider, kind, target);
}
import { LibraryPlaylistArtwork } from "./PlaylistArtwork";

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

/** La pastille « dans la bibliothèque » (bureau : `OwnershipBadge`) : icône ET mot, jamais la seule couleur. */
function OwnershipBadge({ ownership }: { ownership: AlbumOwnership }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={styles.badge} pointerEvents="none" accessibilityLabel={t(ownership === "full" ? "availability.albumFull" : "availability.albumPartial")}>
      <Library size={12} color={theme.colors.status.success} />
      {ownership === "partial" ? (
        <Text style={[typography.caption, styles.badgeText]} numberOfLines={1}>
          {t("availability.partlyShort")}
        </Text>
      ) : null}
    </View>
  );
}

export const AlbumCard = memo(function AlbumCard({ album, width, onLongPress, ownership = null }: { album: MusicAlbum; width: number; onLongPress?: () => void; ownership?: AlbumOwnership | null }) {
  const nav = useOctaveNav();
  const { t } = useTranslation("music");
  const unavailable = isUnavailableAlbum(album, ownership);
  const warm = useOpenWarmup();
  const subtitle = artistsOf(album) || (album.year ? String(album.year) : null);
  // Une sortie importée sans écoute publique : grisée, mais sa page s'ouvre (ses titres, « Voir sur Bandcamp »).
  if (unavailable && !album.imported) {
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
    if (target && !album.jellyfinId) {
      rememberAlbumPreview(target, album);
      // La vue part AVANT la navigation (pas au montage de l'écran) ; jamais à l'appui commencé : un doigt qui
      // pose une rangée pour la faire défiler coûterait une requête YouTube au budget commun.
      warm("album", target);
    }
    nav.album(album);
  };
  return (
    <PressableCard onPress={open} onLongPress={onLongPress} style={{ width }} accessibilityRole="button" accessibilityLabel={`${album.title}, ${subtitle ?? ""}`}>
      <View style={unavailable ? styles.dimmed : undefined}>
        <Artwork url={album.artworkUrl} size={width} radius={10} />
        {album.imported ? <ImportedBadge variant="overlay" /> : ownership ? <OwnershipBadge ownership={ownership} /> : null}
      </View>
      <Caption title={album.title} subtitle={subtitle} muted={unavailable} />
    </PressableCard>
  );
});

export const ArtistCard = memo(function ArtistCard({ artist, width }: { artist: MusicArtist; width: number }) {
  const nav = useOctaveNav();
  const { t } = useTranslation("music");
  const warm = useOpenWarmup();
  const open = () => {
    const target = entityTarget(artist);
    if (target && !artist.jellyfinId) warm("artist", target);
    nav.artist(artist);
  };
  return (
    <PressableCard onPress={open} style={{ width }} accessibilityRole="button" accessibilityLabel={artist.name}>
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
      <LibraryPlaylistArtwork playlist={playlist} size={width} radius={10} />
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
