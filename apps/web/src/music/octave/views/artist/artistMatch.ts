/**
 * Octave — un artiste, de la bibliothèque ET d'ailleurs (mission 3, 26/10) : la page d'un artiste montre ce que
 * Jellyfin a, PUIS ce que l'extension connaît en plus. Règle pure (`artistMatch.test.ts`) :
 *
 * - RATTACHER : même MBID d'artiste ; sinon même nom (casse, accents, ponctuation, « The » de tête ignorés) — mais
 *   jamais deux MBID différents (des homonymes restent deux artistes) ;
 * - JAMAIS DE DOUBLON : un titre ou un album d'ailleurs que la bibliothèque a (règle de jumeaux du cœur,
 *   `POST /api/music/match` : « Jellyfin fait foi ») n'est pas remontré — il est déjà là, comme celui de la
 *   bibliothèque. Un album présent EN PARTIE compte comme présent : sa carte de la bibliothèque est déjà sur la page.
 */

import type { MusicAlbum, MusicArtist, MusicTrack } from "@tentacle-tv/shared/music";
import type { ShownAlbum } from "../../library/ownedItems";

/** Le nom d'un artiste, comparable : « Beyoncé » = « beyonce », « The Beatles » = « Beatles », « AC/DC » = « ac dc ». */
export function normalizeArtistName(name: string): string {
  const plain = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return plain.replace(/^the /, "");
}

type ArtistIdentity = Pick<MusicArtist, "name" | "mbid">;

/** Le même artiste ? MBID d'abord ; le nom seulement quand l'un des deux n'en a pas. */
export function sameArtist(a: ArtistIdentity, b: ArtistIdentity): boolean {
  if (a.mbid && b.mbid) return a.mbid.toLowerCase() === b.mbid.toLowerCase();
  const name = normalizeArtistName(a.name);
  return name.length > 0 && name === normalizeArtistName(b.name);
}

/** Parmi des candidats (une recherche), celui qui EST cet artiste : le MBID égal d'abord, puis le nom. */
export function pickArtist<T extends ArtistIdentity>(target: ArtistIdentity, candidates: readonly T[]): T | null {
  if (target.mbid) {
    const byMbid = candidates.find((c) => c.mbid !== null && c.mbid.toLowerCase() === target.mbid?.toLowerCase());
    if (byMbid) return byMbid;
  }
  return candidates.find((c) => sameArtist(target, c)) ?? null;
}

/** Les titres d'ailleurs que la bibliothèque n'a PAS (après `useOwnedTracks` : un titre reconnu y porte son `jellyfinId`). */
export function tracksElsewhere(tracks: readonly MusicTrack[]): MusicTrack[] {
  return tracks.filter((track) => track.jellyfinId === null);
}

/** Les albums d'ailleurs que la bibliothèque n'a PAS, même en partie (après `useOwnedAlbums`). */
export function albumsElsewhere(albums: readonly ShownAlbum[]): ShownAlbum[] {
  return albums.filter(({ album, ownership }) => ownership === null && album.jellyfinId === null);
}

/** Les albums de la bibliothèque que la page (d'un artiste d'ailleurs) ne montre pas encore. */
export function libraryAlbumsMissing(library: readonly MusicAlbum[], shown: readonly ShownAlbum[]): ShownAlbum[] {
  const present = new Set(shown.map(({ album }) => album.jellyfinId).filter((id): id is string => id !== null));
  return library.filter((album) => album.jellyfinId !== null && !present.has(album.jellyfinId)).map((album) => ({ album, ownership: "full" as const }));
}
