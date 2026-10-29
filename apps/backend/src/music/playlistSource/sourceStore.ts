/**
 * Octave — le relevé de l'ordre de la source d'une playlist importée, dans `music_playlist_sources` (règles :
 * `sourceRecord.ts`). Une ligne par playlist ; effacée avec elle (`playlistService.deletePlaylist`).
 */

import type { MusicPlaylistSource } from "@prisma/client";
import { getPrisma } from "../../services/db";
import { normalizeId } from "../jellyfin/musicJellyfin";
import type { MusicImportSource } from "../contract/musicImport";
import { isImportSource, parseSlots, type PlaylistSourceRecord } from "./sourceRecord";

/** Tous les relevés (une ligne par playlist importée) : l'arrivée d'un titre cherche ceux qui l'attendent. */
export async function listPlaylistSources(): Promise<PlaylistSourceRecord[]> {
  const rows = await getPrisma().musicPlaylistSource.findMany();
  return rows.flatMap((row) => (isImportSource(row.source) ? [recordOf(row, row.source)] : []));
}

export async function readPlaylistSource(playlistId: string): Promise<PlaylistSourceRecord | null> {
  const row = await getPrisma().musicPlaylistSource.findUnique({ where: { playlistId: normalizeId(playlistId) } });
  if (!row || !isImportSource(row.source)) return null;
  return recordOf(row, row.source);
}

function recordOf(row: MusicPlaylistSource, source: MusicImportSource): PlaylistSourceRecord {
  return {
    playlistId: row.playlistId,
    userId: row.userId,
    source,
    url: row.url,
    origin: row.origin === "repair" ? "repair" : "import",
    importedAt: row.importedAt.getTime(),
    slots: parseSlots(row.slotsJson),
  };
}

export async function savePlaylistSource(record: PlaylistSourceRecord): Promise<void> {
  const data = {
    userId: normalizeId(record.userId),
    source: record.source,
    url: record.url,
    origin: record.origin,
    importedAt: new Date(record.importedAt),
    slotsJson: JSON.stringify(record.slots),
  };
  const playlistId = normalizeId(record.playlistId);
  await getPrisma().musicPlaylistSource.upsert({ where: { playlistId }, create: { playlistId, ...data }, update: data });
}

export async function forgetPlaylistSource(playlistId: string): Promise<void> {
  await getPrisma().musicPlaylistSource.deleteMany({ where: { playlistId: normalizeId(playlistId) } });
}
