/**
 * Octave — l'ordre des playlists de la BIBLIOTHÈQUE tel qu'il se montre en ligne (favorites, puis le reste, ordre
 * personnel du compte), relu du cache d'Octave sans réseau : « Sur cet appareil » range ses playlists gardées
 * dedans (`orderDeviceCollections`).
 */

import { useMemo } from "react";
import { useMusicPlaylists, usePlaylistShelf } from "@tentacle-tv/api-client";
import { shelfPlaylistKey } from "@tentacle-tv/shared/music";

export function useLibraryPlaylistOrder(): string[] {
  const shelf = usePlaylistShelf(useMusicPlaylists().data);
  return useMemo(() => [...shelf.favorites, ...shelf.rest].map(shelfPlaylistKey), [shelf.favorites, shelf.rest]);
}
