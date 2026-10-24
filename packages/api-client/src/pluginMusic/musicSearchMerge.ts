/**
 * La recherche musique hors bibliothèque, FUSIONNÉE : les pages progressives
 * d'une extension (`ExternalMusicSearchPage`, `complete` / `cursor`) mises bout
 * à bout, chaque élément une fois (par sa clé), et la BIBLIOTHÈQUE GAGNE — un
 * titre externe dont le MBID d'enregistrement est déjà dans la bibliothèque est
 * retiré (contrat, point 1). Règle pure.
 */

import { normalizeMbid, type ExternalMusicSearchPage, type MusicAlbum, type MusicArtist, type MusicTrack } from "@tentacle-tv/shared/music";

export interface MergedMusicResults {
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  /** La dernière page dit `complete` : plus rien ne viendra. */
  complete: boolean;
}

function uniqueByKey<T extends { key: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
}

/**
 * `libraryRecordings` : les MBID d'enregistrement que la bibliothèque a (ceux
 * de la recherche locale, ou de l'index musique du cœur). `libraryReleases` :
 * pareil pour les albums (MBID de parution), s'il est connu.
 */
export function mergeExternalMusicPages(
  pages: readonly ExternalMusicSearchPage[],
  libraryRecordings: ReadonlySet<string>,
  libraryReleases: ReadonlySet<string> = new Set(),
): MergedMusicResults {
  const inLibrary = (mbid: string | null, set: ReadonlySet<string>) => {
    const normalized = normalizeMbid(mbid);
    return normalized !== null && set.has(normalized);
  };
  const tracks = uniqueByKey(pages.flatMap((p) => p.tracks)).filter((t) => !inLibrary(t.mbids.recording, libraryRecordings));
  const albums = uniqueByKey(pages.flatMap((p) => p.albums)).filter((a) => !inLibrary(a.mbids.release, libraryReleases));
  const artists = uniqueByKey(pages.flatMap((p) => p.artists));
  const last = pages[pages.length - 1];
  return { tracks, albums, artists, complete: last ? last.complete || last.cursor === null : false };
}

/** Une réponse d'extension n'est crue que si elle a la forme d'une page. */
export function readMusicSearchPage(raw: unknown, query: string): ExternalMusicSearchPage | null {
  if (!raw || typeof raw !== "object") return null;
  const page = raw as Partial<ExternalMusicSearchPage>;
  if (!Array.isArray(page.tracks) || !Array.isArray(page.albums) || !Array.isArray(page.artists)) return null;
  return {
    query,
    complete: page.complete === true,
    cursor: typeof page.cursor === "string" && page.cursor !== "" ? page.cursor : null,
    tracks: page.tracks.filter((t): t is MusicTrack => !!t && typeof t.key === "string"),
    albums: page.albums.filter((a): a is MusicAlbum => !!a && typeof a.key === "string"),
    artists: page.artists.filter((a): a is MusicArtist => !!a && typeof a.key === "string"),
  };
}
