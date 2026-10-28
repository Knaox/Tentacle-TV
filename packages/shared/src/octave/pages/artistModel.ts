/**
 * Octave — les règles PURES de la page d'un artiste : les parutions rangées par
 * type (albums, singles et EP, compilations, live, autres), chacune de la plus
 * récente à la plus ancienne ; cinq titres phares montrés, dix au plus.
 */

import type { AlbumKind, MusicAlbum } from "../../music";

export type ReleaseGroup = "albums" | "singles" | "compilations" | "live" | "other";

const GROUP_OF: Record<AlbumKind, ReleaseGroup> = {
  album: "albums",
  single: "singles",
  ep: "singles",
  compilation: "compilations",
  live: "live",
  soundtrack: "other",
  other: "other",
};

const ORDER: ReleaseGroup[] = ["albums", "singles", "compilations", "live", "other"];

/** Titres phares : cinq montrés, dix au plus. */
export const ARTIST_TOP_FOLDED = 5;
export const ARTIST_TOP_MAX = 10;

/** Les parutions par type, chacune de la plus récente à la plus ancienne. */
export function groupReleases<T extends { album: MusicAlbum }>(albums: readonly T[]): { group: ReleaseGroup; albums: T[] }[] {
  const map = new Map<ReleaseGroup, T[]>();
  for (const a of albums) map.set(GROUP_OF[a.album.kind], [...(map.get(GROUP_OF[a.album.kind]) ?? []), a]);
  const date = (a: MusicAlbum) => a.releaseDate ?? String(a.year ?? "");
  return ORDER.filter((g) => map.has(g)).map((group) => ({
    group,
    albums: [...(map.get(group) ?? [])].sort((x, y) => date(y.album).localeCompare(date(x.album))),
  }));
}
