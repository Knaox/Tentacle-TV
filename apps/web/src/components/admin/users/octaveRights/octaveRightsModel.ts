import type { UserRights, UserRightsOptions } from "@tentacle-tv/shared";
import type { SummaryPart } from "../rights/rightsModel";

/**
 * Les règles PURES de la rubrique « Musique · Octave » de la fiche des droits :
 * quelles bibliothèques sont de la musique, ce que le compte en voit, et l'état
 * en une ligne. Les bibliothèques de musique sont celles que Jellyfin range en
 * `CollectionType = music` — celles qu'Octave lit.
 */

export interface MusicLibrary {
  id: string;
  name: string;
}

export function isMusicLibrary(collectionType: string | null | undefined): boolean {
  return (collectionType ?? "").toLowerCase() === "music";
}

export function musicLibrariesOf(options: UserRightsOptions | undefined): MusicLibrary[] {
  return (options?.libraries ?? []).filter((library) => isMusicLibrary(library.collectionType)).map(({ id, name }) => ({ id, name }));
}

export type MusicLibraryAccess =
  | { mode: "all" }
  | { mode: "some"; count: number; total: number }
  | { mode: "none"; total: number };

/** Ce que le compte voit des bibliothèques de musique (le même champ que « Bibliothèques »). */
export function musicLibraryAccess(rights: UserRights, libraries: readonly MusicLibrary[]): MusicLibraryAccess {
  if (rights.enableAllFolders) return { mode: "all" };
  const count = libraries.filter((library) => rights.enabledFolders.includes(library.id)).length;
  return count > 0 ? { mode: "some", count, total: libraries.length } : { mode: "none", total: libraries.length };
}

/** L'état de la rubrique en une ligne (clés de l'espace `userRights`, sous `octave.summary`). */
export function octaveSummary(access: boolean | null, rights: UserRights, libraries: readonly MusicLibrary[]): SummaryPart[] {
  if (access === false) return [{ key: "octave.summary.noAccess" }];
  const parts: SummaryPart[] = [];
  if (access === true) parts.push({ key: "octave.summary.access" });
  if (!rights.enableMediaPlayback) parts.push({ key: "octave.summary.noPlayback" });
  if (libraries.length === 0) {
    parts.push({ key: "octave.summary.noMusicLibrary" });
  } else {
    const seen = musicLibraryAccess(rights, libraries);
    if (seen.mode === "all") parts.push({ key: "octave.summary.allMusic" });
    else if (seen.mode === "some") parts.push({ key: "octave.summary.someMusic", values: { count: seen.count, total: seen.total } });
    else parts.push({ key: "octave.summary.noMusic" });
  }
  if (rights.enableContentDownloading) parts.push({ key: "octave.summary.offline" });
  return parts;
}

/** Bits/s → Mbit/s affichés (une décimale) ; 0 : sans limite. */
export function bitrateMbps(bits: number): number | null {
  return bits > 0 ? Math.round(bits / 100_000) / 10 : null;
}
