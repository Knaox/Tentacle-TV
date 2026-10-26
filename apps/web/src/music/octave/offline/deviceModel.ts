/**
 * Octave — « Sur cet appareil », modèle PUR (`deviceModel.test.ts`) : les titres
 * gardés relus de leur fiche (`trackJson`, sans réseau), leur pochette LOCALE
 * quand elle est sur le disque, et les albums et playlists gardés en entier,
 * dans leur ordre.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack } from "@tentacle-tv/shared/music";

export interface DeviceCollection {
  key: string;
  kind: "album" | "playlist";
  title: string;
  subtitle: string | null;
  artworkUrl: string | null;
  tracks: MusicTrack[];
}

export interface DeviceModel {
  tracks: MusicTrack[];
  collections: DeviceCollection[];
}

/** Le titre tel que l'interface le montrait ; une fiche illisible se refait des colonnes gardées. */
export function keptToTrack(kept: KeptMusicTrack, localUrl: (rel: string) => string | null): MusicTrack {
  let track: MusicTrack | null = null;
  try {
    const parsed: unknown = JSON.parse(kept.trackJson);
    if (parsed && typeof parsed === "object" && (parsed as MusicTrack).key === kept.trackKey) track = parsed as MusicTrack;
  } catch {
    track = null;
  }
  const base: MusicTrack = track ?? {
    key: kept.trackKey,
    jellyfinId: kept.origin === "library" ? kept.itemId : null,
    external: null,
    title: kept.title,
    artists: kept.artist ? [{ name: kept.artist, mbid: null, jellyfinId: null }] : [],
    album: kept.album ? { title: kept.album, mbid: null, jellyfinId: null } : null,
    durationMs: kept.durationMs,
    trackNumber: kept.trackNumber,
    discNumber: kept.discNumber,
    year: null,
    artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] },
    availability: kept.origin === "library" ? "library" : "cache",
    format: null,
    favorite: false,
  };
  const local = kept.coverRel ? localUrl(kept.coverRel) : null;
  return local ? { ...base, artworkUrl: local } : base;
}

export function deviceModel(
  kept: readonly KeptMusicTrack[],
  collections: readonly KeptMusicCollection[],
  localUrl: (rel: string) => string | null,
  options: { completeOnly: boolean },
): DeviceModel {
  const shown = options.completeOnly ? kept.filter((k) => k.status === "complete") : kept.filter((k) => k.status !== "canceled");
  const byKey = new Map(shown.map((k) => [k.trackKey, keptToTrack(k, localUrl)]));
  const out: DeviceCollection[] = [];
  for (const c of collections) {
    // Un titre gardé seul n'est pas une collection à montrer : il ne fait que le retenir.
    if (c.kind === "track") continue;
    const tracks = c.trackKeys.map((key) => byKey.get(key)).filter((t): t is MusicTrack => !!t);
    if (tracks.length === 0) continue;
    out.push({ key: c.key, kind: c.kind, title: c.title, subtitle: c.subtitle, artworkUrl: tracks.find((t) => t.artworkUrl)?.artworkUrl ?? null, tracks });
  }
  return { tracks: [...byKey.values()], collections: out };
}
