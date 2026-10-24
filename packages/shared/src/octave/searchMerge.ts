/**
 * Octave — la recherche : la BIBLIOTHÈQUE d'abord, puis, si une extension
 * musique est là, sa section « hors bibliothèque », remplie page après page.
 *
 * Règle du contrat (point 1) : un résultat externe dont l'enregistrement
 * (MBID) est déjà dans la bibliothèque est retiré — la bibliothèque gagne.
 * Même chose pour un album dont le groupe de parution y est déjà.
 */

import type { ExternalMusicSearchPage, MusicAlbum, MusicArtist, MusicSearchResponse, MusicTrack } from "../music";

export interface ExternalSection {
  pluginId: string;
  label: string;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  /** Toutes les pages sont là. */
  complete: boolean;
}

export interface LibraryKnowledge {
  recordings: ReadonlySet<string>;
  releaseGroups: ReadonlySet<string>;
  artists: ReadonlySet<string>;
}

export function knowledgeOf(library: MusicSearchResponse | undefined, extraRecordings: Iterable<string> = []): LibraryKnowledge {
  const recordings = new Set<string>(extraRecordings);
  const releaseGroups = new Set<string>();
  const artists = new Set<string>();
  for (const t of library?.tracks ?? []) if (t.mbids.recording) recordings.add(t.mbids.recording);
  for (const a of library?.albums ?? []) if (a.mbids.releaseGroup) releaseGroups.add(a.mbids.releaseGroup);
  for (const a of library?.artists ?? []) if (a.mbid) artists.add(a.mbid);
  return { recordings, releaseGroups, artists };
}

/** Ajoute une page à une section, sans doublon de clé. */
export function appendPage(section: ExternalSection, page: ExternalMusicSearchPage): ExternalSection {
  const add = <T extends { key: string }>(list: T[], more: T[]) => {
    const seen = new Set(list.map((x) => x.key));
    return [...list, ...more.filter((x) => !seen.has(x.key))];
  };
  return {
    ...section,
    tracks: add(section.tracks, page.tracks),
    albums: add(section.albums, page.albums),
    artists: add(section.artists, page.artists),
    complete: page.complete,
  };
}

/** La section telle qu'elle s'affiche : ce que la bibliothèque a déjà en est retiré. */
export function visibleSection(section: ExternalSection, known: LibraryKnowledge): ExternalSection {
  return {
    ...section,
    tracks: section.tracks.filter((t) => !t.mbids.recording || !known.recordings.has(t.mbids.recording)),
    albums: section.albums.filter((a) => !a.mbids.releaseGroup || !known.releaseGroups.has(a.mbids.releaseGroup)),
    artists: section.artists.filter((a) => !a.mbid || !known.artists.has(a.mbid)),
  };
}

/** Les enregistrements externes à vérifier contre TOUTE la bibliothèque (`by-mbid`), pas seulement les résultats. */
export function recordingsToCheck(sections: readonly ExternalSection[], known: LibraryKnowledge, checked: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const s of sections) {
    for (const t of s.tracks) {
      const r = t.mbids.recording;
      if (r && !known.recordings.has(r) && !checked.has(r)) out.add(r);
    }
  }
  return [...out];
}

export function isSectionEmpty(section: ExternalSection): boolean {
  return section.tracks.length === 0 && section.albums.length === 0 && section.artists.length === 0;
}
