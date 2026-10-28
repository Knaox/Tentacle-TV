/**
 * Octave — la jaquette d'une collection GARDÉE (« Sur cet appareil »), règle pure (`keptPlaylistArt.test.ts`).
 *
 * Une playlist gardée prend la MÊME jaquette qu'en ligne : la règle partagée (`musicMosaic.ts`) sur les mêmes
 * titres de la bibliothèque, le même jour, la même playlist — avec les pochettes GARDÉES sur le disque. Les albums
 * se choisissent d'après la fiche du serveur (`trackJson`), qui dit l'album et l'image d'origine ; seule l'image
 * montrée est la locale. Sans réseau, une pochette qui n'est pas sur le disque ne compte pas (jamais une case qui ne
 * charge pas). Un album gardé garde sa pochette.
 *
 * Limite : une image posée à la main sur la playlist n'est pas gardée sur l'appareil — hors ligne, c'est la
 * jaquette composée qui la remplace.
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { mosaicCandidates, pickMosaic, type MosaicTrack } from "@tentacle-tv/shared/music";
import type { DeviceCollection } from "./deviceModel";
import { keptToTrack } from "./deviceModel";

const PLAYLIST_PREFIX = "playlist:jf:";

/** La playlist Jellyfin d'une collection gardée (`playlist:jf:<id>`), `null` pour un album. */
export function keptPlaylistId(collection: { key: string; kind: string }): string | null {
  return collection.kind === "playlist" && collection.key.startsWith(PLAYLIST_PREFIX) ? collection.key.slice(PLAYLIST_PREFIX.length) : null;
}

interface Source extends MosaicTrack {
  shown: string | null;
  library: boolean;
}

/**
 * Les images de la jaquette d'une collection gardée. `remote` : l'appareil a du réseau (une pochette pas encore
 * sur le disque peut alors venir du serveur, comme dans la liste des titres).
 */
export function keptCollectionCover(collection: DeviceCollection, kept: readonly KeptMusicTrack[], options: { now: number; remote: boolean }): string[] {
  const fallback = collection.artworkUrl ? [collection.artworkUrl] : [];
  const playlistId = keptPlaylistId(collection);
  if (playlistId === null) return fallback;
  const byKey = new Map(kept.map((k) => [k.trackKey, k]));
  const sources: Source[] = [];
  for (const track of collection.tracks) {
    const raw = byKey.get(track.key);
    if (!raw) continue;
    const server = keptToTrack(raw, () => null);
    const local = raw.coverRel && track.artworkUrl !== server.artworkUrl ? track.artworkUrl : null;
    sources.push({ album: server.album, artists: server.artists, artworkUrl: server.artworkUrl, shown: local ?? (options.remote ? server.artworkUrl : null), library: server.jellyfinId !== null });
  }
  // Le cœur compose d'après les titres de la BIBLIOTHÈQUE (les attentes n'y sont pas) : pareil ici, s'il y en a.
  const library = sources.filter((s) => s.library);
  const urls = pickMosaic(mosaicCandidates(library.length > 0 ? library : sources, (s) => s.shown), playlistId, options.now);
  return urls.length > 0 ? urls : fallback;
}
