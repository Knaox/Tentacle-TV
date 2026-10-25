/**
 * Octave — un album d'AILLEURS face à la bibliothèque (vue album) : entièrement présent, la vue de la
 * bibliothèque le remplace (`libraryAlbumId`) ; en partie, ses titres présents sont ceux de la bibliothèque,
 * piste par piste. Un album de la bibliothèque, ou l'aperçu de la carte (sans titres), ne demande rien.
 */

import { useMemo } from "react";
import { useMusicLibraryMatch } from "@tentacle-tv/api-client";
import type { MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { ownedTracks } from "./ownedItems";

const NO_TRACKS: never[] = [];

export interface AlbumOwnership {
  /** L'album de la bibliothèque qui EST celui-ci, en entier : la vue s'y rend. */
  libraryAlbumId: string | null;
  tracks: readonly MusicTrack[];
  /** La réponse est là (ou rien à demander) : avant, ne rien montrer qui changerait sous les yeux. */
  settled: boolean;
}

export function useAlbumOwnership(album: MusicAlbum | null | undefined, tracks: readonly MusicTrack[], preview: boolean): AlbumOwnership {
  const elsewhere = !!album && album.jellyfinId === null && !preview;
  const entries = useMemo(() => (elsewhere && album ? [{ album, tracks }] : []), [elsewhere, album, tracks]);
  const matches = useMusicLibraryMatch(NO_TRACKS, entries);
  const match = album ? matches.albums.get(album.key) : undefined;
  const owned = useMemo(() => ownedTracks(tracks, matches.tracks), [tracks, matches.tracks]);
  return {
    libraryAlbumId: match?.coverage === "full" ? match.album.jellyfinId : null,
    tracks: owned,
    settled: !elsewhere || matches.settled,
  };
}
