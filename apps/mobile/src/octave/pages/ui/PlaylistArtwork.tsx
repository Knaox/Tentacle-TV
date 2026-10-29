/**
 * Octave mobile — la jaquette d'une playlist, rendue comme sur le bureau (`playlistCover.ts`, shared) : la
 * mosaïque du jour du cœur en grille 2 × 2 bord à bord que le CADRE arrondit, ou une seule pochette ; sans image,
 * le disque dessiné d'`Artwork`. Hors ligne, « Sur cet appareil » passe les pochettes gardées (une case `null` :
 * pochette absente du disque, teintée par le repli). Place carrée réservée, aucune animation de plus que le fondu
 * d'`Artwork`. Image décorative : le nom est écrit à côté.
 */

import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { playlistCoverLayout, playlistCoverUrls, type MusicPlaylist } from "@tentacle-tv/shared/music";
import { useTheme } from "@/theme";
import { Artwork } from "./Artwork";

interface PlaylistArtworkProps {
  urls: readonly (string | null)[];
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export const PlaylistArtwork = memo(function PlaylistArtwork({ urls, size, radius = 10, style }: PlaylistArtworkProps) {
  const theme = useTheme();
  const layout = playlistCoverLayout(urls);
  if (layout.kind === "single") return <Artwork url={layout.url} size={size} radius={radius} style={style} />;
  const half = size / 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, flexDirection: "row", flexWrap: "wrap", borderRadius: radius, overflow: "hidden", backgroundColor: theme.colors.surface.s2 }, style]}
    >
      {layout.cells.map((url, cell) => (
        <Artwork key={`${cell}:${url ?? ""}`} url={url} size={half} radius={0} />
      ))}
    </View>
  );
});

/** La jaquette d'une playlist de la bibliothèque : sa mosaïque du jour, sinon son image. */
export const LibraryPlaylistArtwork = memo(function LibraryPlaylistArtwork({ playlist, ...rest }: Omit<PlaylistArtworkProps, "urls"> & { playlist: Pick<MusicPlaylist, "mosaic" | "artworkUrl"> }) {
  return <PlaylistArtwork urls={playlistCoverUrls(playlist)} {...rest} />;
});
