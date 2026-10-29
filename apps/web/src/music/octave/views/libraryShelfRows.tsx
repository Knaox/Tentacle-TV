/**
 * Octave — ce que montre une rangée de la fenêtre « Réordonner » de la bibliothèque (vignette, titre, sous-titre),
 * par rubrique ; et la carte d'une playlist favorite d'une extension (celle de la recherche).
 */

import type { TFunction } from "i18next";
import type { MusicAlbum, MusicArtist, MusicShelfPlaylist } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import { PlaylistArtwork, playlistCoverUrls } from "../components/PlaylistArtwork";
import type { ReorderRow } from "../collections/ShelfReorderDialog";

export { ExternalPlaylistCard } from "../search/ExternalPlaylistCard";

type Row = Omit<ReorderRow, "key">;

export const albumRow = (album: MusicAlbum): Row => ({
  title: album.title,
  subtitle: album.artists.map((a) => a.name).join(", "),
  artwork: <Artwork url={album.artworkUrl} label={album.title} radius="xs" thumb className="h-10 w-10" />,
});

export const artistRow = (artist: MusicArtist): Row => ({
  title: artist.name,
  subtitle: "",
  artwork: <Artwork url={artist.imageUrl} kind="artist" label={artist.name} round thumb className="h-10 w-10" />,
});

/** `t` : l'espace `music` (le nombre de titres). */
export const playlistRow = (entry: MusicShelfPlaylist, t: TFunction): Row =>
  entry.kind === "library"
    ? {
        title: entry.playlist.name,
        subtitle: t("count.tracks", { count: entry.playlist.trackCount }),
        artwork: <PlaylistArtwork urls={playlistCoverUrls(entry.playlist)} label={entry.playlist.name} radius="xs" thumb className="h-10 w-10" />,
      }
    : {
        title: entry.playlist.title,
        subtitle: entry.playlist.owner ?? "",
        artwork: <Artwork url={entry.playlist.artworkUrl} label={entry.playlist.title} radius="xs" thumb className="h-10 w-10" />,
      };
