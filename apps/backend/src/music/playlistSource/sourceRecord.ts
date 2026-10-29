/**
 * Octave — l'ORDRE DE LA SOURCE d'une playlist importée, tel que le cœur le garde (`music_playlist_sources`). Pur.
 *
 * Jusqu'au 27/10, l'ordre de la source n'était gardé nulle part : la playlist Jellyfin ne recevait que les titres
 * de la bibliothèque, et chaque absent sa POSITION du moment (le nombre de présents avant lui), que chaque
 * insertion rendait fausse. Le cœur garde désormais, pour chaque titre de la source, son rang, sa fiche (titre,
 * artistes, album, durée : de quoi le reconnaître) et les éléments Jellyfin qui le tiennent dans la playlist.
 */

import type { MusicMatchTrackQuery } from "../contract/musicCoreApi";
import { MUSIC_IMPORT_SOURCES, type ImportedTrack, type MusicImportSource } from "../contract/musicImport";
import { sourceRankDate } from "../contract/musicSourceOrder";

/** `import` : posé à l'import (ses rangs sont ceux que l'extension a reçus) ; `repair` : la source relue après coup. */
export type SourceOrigin = "import" | "repair";

export interface SourceSlot {
  rank: number;
  title: string;
  artists: string[];
  album: string | null;
  durationMs: number | null;
  /** Les éléments Jellyfin (normalisés) qui tiennent ce titre dans la playlist : deux pour un doublon, une autre version. */
  itemIds: string[];
  /** L'utilisateur l'a RETIRÉ de la playlist (l'entrée de l'extension) : son arrivée ne l'y remet jamais. */
  removed?: true;
}

export interface PlaylistSourceRecord {
  playlistId: string;
  userId: string;
  source: MusicImportSource;
  url: string | null;
  origin: SourceOrigin;
  importedAt: number;
  slots: SourceSlot[];
}

/** Les titres de la source, dans son ordre ; `found` : rang → élément de la bibliothèque entré dans la playlist. */
export function slotsOf(tracks: readonly ImportedTrack[], found: ReadonlyMap<number, string>): SourceSlot[] {
  return tracks.map((t) => {
    const itemId = found.get(t.index);
    return { rank: t.index, title: t.title, artists: [...t.artists], album: t.album, durationMs: t.durationMs, itemIds: itemId ? [itemId] : [] };
  });
}

/** Le rang de chaque élément tenu (le plus petit, s'il tient deux titres de la source). */
export function ranksByItem(record: PlaylistSourceRecord): Map<string, number> {
  const out = new Map<string, number>();
  for (const slot of record.slots) for (const id of slot.itemIds) if (!out.has(id) || out.get(id)! > slot.rank) out.set(id, slot.rank);
  return out;
}

/** Le même relevé, ces éléments tenant désormais le titre de rang `rank` (jamais deux fois le même). */
export function bound(record: PlaylistSourceRecord, rank: number, itemIds: readonly string[]): PlaylistSourceRecord {
  return {
    ...record,
    slots: record.slots.map((slot) => (slot.rank === rank ? { ...slot, itemIds: [...new Set([...slot.itemIds, ...itemIds])] } : slot)),
  };
}

/** Le même relevé, le titre de rang `rank` RETIRÉ par l'utilisateur ; `null` : aucun titre de ce rang. */
export function removedAt(record: PlaylistSourceRecord, rank: number): PlaylistSourceRecord | null {
  if (!record.slots.some((slot) => slot.rank === rank)) return null;
  return { ...record, slots: record.slots.map((slot) => (slot.rank === rank ? { ...slot, removed: true as const } : slot)) };
}

/** La fiche d'un titre de la source, pour LA règle du cœur (`musicLibraryMatch.ts`). */
export function slotQuery(slot: SourceSlot): MusicMatchTrackQuery {
  return {
    ref: String(slot.rank),
    title: slot.title,
    artists: slot.artists.map((name) => ({ name, mbid: null })),
    albumTitle: slot.album,
    durationMs: slot.durationMs,
    recording: null,
  };
}

/**
 * La date d'ajout de chaque élément de `itemIds` tenu par un titre de la source : son RANG, avant l'import (le
 * dernier de la source le plus récent). Un élément hors source n'en a pas : il garde la règle ordinaire.
 */
export function pinnedDates(record: PlaylistSourceRecord, itemIds: readonly string[]): Map<string, number> {
  const ranks = ranksByItem(record);
  const total = record.slots.reduce((top, s) => Math.max(top, s.rank + 1), 0);
  const out = new Map<string, number>();
  for (const id of itemIds) {
    const rank = ranks.get(id);
    if (rank !== undefined) out.set(id, sourceRankDate(record.importedAt, total, rank));
  }
  return out;
}

const text = (value: unknown, max: number): string | null => (typeof value === "string" && value.length <= max ? value : null);

/** Le JSON gardé, relu prudemment : un titre mal formé est ignoré, jamais une erreur. */
export function parseSlots(json: string): SourceSlot[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: SourceSlot[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    const title = text(r?.title, 500);
    if (!title || !Number.isInteger(r.rank) || (r.rank as number) < 0) continue;
    out.push({
      rank: r.rank as number,
      title,
      artists: Array.isArray(r.artists) ? r.artists.filter((a): a is string => typeof a === "string").slice(0, 20) : [],
      album: text(r.album, 500),
      durationMs: typeof r.durationMs === "number" && Number.isFinite(r.durationMs) ? r.durationMs : null,
      itemIds: Array.isArray(r.itemIds) ? r.itemIds.filter((i): i is string => typeof i === "string" && /^[0-9a-f]{32}$/.test(i)) : [],
      ...(r.removed === true ? { removed: true as const } : {}),
    });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

export function isImportSource(value: string): value is MusicImportSource {
  return (MUSIC_IMPORT_SOURCES as readonly string[]).includes(value);
}
