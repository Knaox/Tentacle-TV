/**
 * Octave — un album ou un artiste, de la bibliothèque ou hors bibliothèque (clé `ext:<pluginId>:<id>`). Les
 * crochets vivent dans api-client (`useMusicAlbumEntity`, `useMusicArtistEntity`, lus aussi par le mobile) ; ici,
 * l'extension de ce serveur et l'aperçu de la carte cliquée (`albumPreview.ts`).
 */

import { useMusicAlbumEntity, useMusicArtistEntity, type MusicEntityState } from "@tentacle-tv/api-client";
import type { MusicAlbum, MusicArtist } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { albumPreview } from "./albumPreview";

export function useAlbumEntity(idOrKey: string): MusicEntityState<MusicAlbum> {
  return useMusicAlbumEntity(useOctaveProvider(), idOrKey, albumPreview);
}

export function useArtistEntity(idOrKey: string): MusicEntityState<MusicArtist> {
  return useMusicArtistEntity(useOctaveProvider(), idOrKey);
}
