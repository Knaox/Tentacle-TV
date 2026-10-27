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
  /** La clé de chaque titre DANS la collection (celle d'aujourd'hui), parallèle à `tracks`. */
  keys: string[];
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

export interface DeviceModelOptions {
  completeOnly: boolean;
  /**
   * La copie d'une clé telle que la collection la nomme, RENOMMAGES compris (`keptMusicStore` → `byKey`) : un titre
   * qui a changé d'identité depuis qu'il a été gardé reste à sa place dans sa playlist. Absente : la clé de la copie.
   */
  resolve?: (key: string) => KeptMusicTrack | undefined;
}

export function deviceModel(
  kept: readonly KeptMusicTrack[],
  collections: readonly KeptMusicCollection[],
  localUrl: (rel: string) => string | null,
  options: DeviceModelOptions,
): DeviceModel {
  const visible = (k: KeptMusicTrack) => (options.completeOnly ? k.status === "complete" : k.status !== "canceled");
  const shown = kept.filter(visible);
  const asTrack = new Map<KeptMusicTrack, MusicTrack>();
  const trackOf = (k: KeptMusicTrack): MusicTrack => {
    let track = asTrack.get(k);
    if (!track) asTrack.set(k, (track = keptToTrack(k, localUrl)));
    return track;
  };
  const byKey = new Map(shown.map((k) => [k.trackKey, k]));
  const copyOf = (key: string): KeptMusicTrack | undefined => {
    const resolved = options.resolve?.(key);
    return resolved && visible(resolved) ? resolved : byKey.get(key);
  };
  const out: DeviceCollection[] = [];
  for (const c of collections) {
    // Un titre gardé seul n'est pas une collection à montrer : il ne fait que le retenir.
    if (c.kind === "track") continue;
    // L'ordre est celui de la collection (`trackKeys`), que la tenue à jour aligne sur la playlist en ligne.
    const found = c.trackKeys.flatMap((key) => {
      const copy = copyOf(key);
      return copy ? [{ key, track: trackOf(copy) }] : [];
    });
    if (found.length === 0) continue;
    const tracks = found.map((f) => f.track);
    out.push({ key: c.key, kind: c.kind, title: c.title, subtitle: c.subtitle, artworkUrl: tracks.find((t) => t.artworkUrl)?.artworkUrl ?? null, tracks, keys: found.map((f) => f.key) });
  }
  return { tracks: [...byKey.values()].map(trackOf), collections: out };
}
