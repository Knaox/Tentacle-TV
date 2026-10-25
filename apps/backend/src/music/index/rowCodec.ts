/**
 * Octave — l'aller-retour d'une ligne de l'index entre le code et SQLite. Pur.
 *
 * - Les dates se LIENT en `Date` (docs/sqlite/DECISION.md § 2 : le moteur les
 *   écrit en INTEGER ms) et se RELISENT en `Date` : `getTime()`.
 * - `BIGINT` revient en `bigint` d'une lecture brute : `Number()`.
 * - La table FTS5 a son `rowid` tiré de l'identifiant Jellyfin (13 chiffres
 *   hexadécimaux = 52 bits, sous 2^53) : effacer une ligne de la recherche est
 *   alors un accès direct, jamais un balayage de la table virtuelle.
 */

import type { MusicAudioFormat } from "../contract/musicTypes";
import type { IndexArtist, IndexKind, IndexRow } from "./indexTypes";

export const COLUMNS = [
  "id", "kind", "name", "sortName", "albumId", "albumName", "albumArtist", "artistsJson", "year",
  "trackNumber", "discNumber", "durationMs", "recordingMbid", "releaseMbid", "releaseGroupMbid",
  "artistMbid", "formatJson", "sizeBytes", "normalizationGain", "imageTag", "childCount",
  "dateCreated", "syncedAt", "generation",
] as const;

export type SqlValue = string | number | null | Date;

export function ftsRowid(id: string): number {
  return parseInt(id.slice(0, 13), 16);
}

/** La recherche ne connaît ni accents (FTS5 les retire) ni ligatures (ici). */
export function foldForSearch(text: string): string {
  return text
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[’‘`´]/g, "'");
}

export function rowValues(row: IndexRow, syncedAt: Date, generation: number): SqlValue[] {
  return [
    row.id, row.kind, row.name, row.sortName, row.albumId, row.albumName, row.albumArtist,
    JSON.stringify(row.artists), row.year, row.trackNumber, row.discNumber, row.durationMs,
    row.recordingMbid, row.releaseMbid, row.releaseGroupMbid, row.artistMbid,
    row.format ? JSON.stringify(row.format) : null, row.sizeBytes, row.normalizationGain, row.imageTag,
    row.childCount, row.dateCreated === null ? null : new Date(row.dateCreated), syncedAt, generation,
  ];
}

/** Les colonnes cherchables d'une ligne : son nom, ses artistes, son album. */
export function ftsValues(row: IndexRow): SqlValue[] {
  const artists = row.artists.map((a) => a.name).join(" ");
  const album = row.kind === "track" ? (row.albumName ?? "") : row.kind === "album" ? (row.albumArtist ?? "") : "";
  return [ftsRowid(row.id), row.id, row.kind, foldForSearch(row.name), foldForSearch(artists), foldForSearch(album)];
}

export interface DbRow {
  id: string;
  kind: string;
  name: string;
  sortName: string;
  albumId: string | null;
  albumName: string | null;
  albumArtist: string | null;
  artistsJson: string;
  year: number | bigint | null;
  trackNumber: number | bigint | null;
  discNumber: number | bigint | null;
  durationMs: number | bigint | null;
  recordingMbid: string | null;
  releaseMbid: string | null;
  releaseGroupMbid: string | null;
  artistMbid: string | null;
  formatJson: string | null;
  sizeBytes: number | bigint | null;
  normalizationGain: number | null;
  replayGainJson?: string | null;
  imageTag: string | null;
  childCount: number | bigint | null;
  dateCreated: Date | number | bigint | null;
}

function num(value: number | bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function time(value: Date | number | bigint | null): number | null {
  if (value === null) return null;
  return value instanceof Date ? value.getTime() : Number(value);
}

function parse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function fromDb(row: DbRow): IndexRow {
  return {
    id: row.id,
    kind: row.kind as IndexKind,
    name: row.name,
    sortName: row.sortName,
    albumId: row.albumId,
    albumName: row.albumName,
    albumArtist: row.albumArtist,
    artists: parse<IndexArtist[]>(row.artistsJson, []),
    year: num(row.year),
    trackNumber: num(row.trackNumber),
    discNumber: num(row.discNumber),
    durationMs: num(row.durationMs),
    recordingMbid: row.recordingMbid,
    releaseMbid: row.releaseMbid,
    releaseGroupMbid: row.releaseGroupMbid,
    artistMbid: row.artistMbid,
    format: parse<MusicAudioFormat | null>(row.formatJson, null),
    sizeBytes: num(row.sizeBytes),
    normalizationGain: row.normalizationGain,
    imageTag: row.imageTag,
    childCount: num(row.childCount),
    dateCreated: time(row.dateCreated),
  };
}
