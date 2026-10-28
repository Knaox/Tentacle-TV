/**
 * Octave — des albums montrés hors bibliothèque : entièrement présents, ceux de la bibliothèque ; en partie,
 * marqués (`ownedAlbums`). Une requête au cœur, sur l'index local, en cache.
 */

import { useMemo } from "react";
import { useMusicLibraryMatch } from "../useMusicLibraryMatch";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { ownedAlbums, type ShownAlbum } from "./ownedItems";

const NO_TRACKS: never[] = [];

export function useOwnedAlbums(albums: readonly MusicAlbum[]): ShownAlbum[] {
  const entries = useMemo(() => albums.map((album) => ({ album })), [albums]);
  const matches = useMusicLibraryMatch(NO_TRACKS, entries);
  return useMemo(() => ownedAlbums(albums, matches.albums), [albums, matches.albums]);
}
