/**
 * Octave mobile — une carte de la grille de la bibliothèque (album, artiste, playlist de la bibliothèque ou
 * d'une extension), avec la rubrique où elle vit (son appui maintenu y offre « Mettre en haut » et
 * « Réordonner ») ; et la même, en rangée du mode « Réordonner ».
 */

import { memo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AlbumCard, ArtistCard, ExternalPlaylistCard, PlaylistCard, type CardShelfContext } from "../ui/Cards";
import { Artwork } from "../ui/Artwork";
import { LibraryPlaylistArtwork } from "../ui/PlaylistArtwork";
import type { ShelfReorderItem } from "../../collections/reorder/ShelfReorderList";
import type { LibraryItem } from "./useLibraryShelfView";

export const LibraryCard = memo(function LibraryCard({ item, width, menu }: { item: LibraryItem; width: number; menu?: CardShelfContext }) {
  if (item.kind === "album") return <AlbumCard album={item.album} width={width} menu={menu} />;
  if (item.kind === "artist") return <ArtistCard artist={item.artist} width={width} menu={menu} />;
  if (item.entry.kind === "library") return <PlaylistCard playlist={item.entry.playlist} width={width} menu={menu} />;
  return <ExternalPlaylistCard playlist={item.entry.playlist} width={width} menu={menu} />;
});

const ART = 44;

/** La rangée du mode « Réordonner » : pochette, nom, et ce qu'il est. */
export function useReorderItemOf(): (item: LibraryItem, key: string) => ShelfReorderItem {
  const { t } = useTranslation("music");
  return (item, key) => {
    let art: ReactElement;
    let name: string;
    let subtitle: string | null;
    if (item.kind === "album") {
      art = <Artwork url={item.album.artworkUrl} size={ART} radius={6} />;
      name = item.album.title;
      subtitle = item.album.artists.map((a) => a.name).join(", ") || null;
    } else if (item.kind === "artist") {
      art = <Artwork url={item.artist.imageUrl} size={ART} round kind="artist" />;
      name = item.artist.name;
      subtitle = t("search.kindArtist");
    } else if (item.entry.kind === "library") {
      art = <LibraryPlaylistArtwork playlist={item.entry.playlist} size={ART} radius={6} />;
      name = item.entry.playlist.name;
      subtitle = t("count.tracks", { count: item.entry.playlist.trackCount ?? 0 });
    } else {
      art = <Artwork url={item.entry.playlist.artworkUrl} size={ART} radius={6} />;
      name = item.entry.playlist.title;
      subtitle = item.entry.playlist.owner;
    }
    return { key, name, subtitle, art };
  };
}
