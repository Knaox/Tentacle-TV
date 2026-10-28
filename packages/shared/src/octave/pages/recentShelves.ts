/**
 * Octave — les rangées « consultés récemment » de la recherche vide : les pages
 * ouvertes sur l'appareil d'abord (`recentVisits.ts`), complétées par ce que
 * l'accueil du serveur sait des écoutes du compte (albums et artistes du
 * moment, aussi des autres appareils). Règle pure : un élément une fois (clé ou
 * élément Jellyfin), l'ordre gardé, une rangée au plus.
 */

import type { MusicAlbum, MusicArtist } from "../../music";
import type { RecentVisit } from "./recentVisits";

export const RECENT_SHELF_MAX = 12;

function mergeDistinct<T extends { key: string; jellyfinId: string | null }>(first: readonly T[], then: readonly T[], max: number): T[] {
  const keys = new Set<string>();
  const out: T[] = [];
  for (const item of [...first, ...then]) {
    if (keys.has(item.key) || (item.jellyfinId && keys.has(`jf:${item.jellyfinId}`))) continue;
    keys.add(item.key);
    if (item.jellyfinId) keys.add(`jf:${item.jellyfinId}`);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export interface RecentShelves {
  albums: MusicAlbum[];
  artists: MusicArtist[];
}

export function buildRecentShelves(
  visits: readonly RecentVisit[],
  fromHome: { recentAlbums?: readonly MusicAlbum[]; recentArtists?: readonly MusicArtist[] } | undefined,
  max = RECENT_SHELF_MAX,
): RecentShelves {
  const albums = visits.flatMap((v) => (v.kind === "album" ? [v.item] : []));
  const artists = visits.flatMap((v) => (v.kind === "artist" ? [v.item] : []));
  return {
    albums: mergeDistinct(albums, fromHome?.recentAlbums ?? [], max),
    artists: mergeDistinct(artists, fromHome?.recentArtists ?? [], max),
  };
}
