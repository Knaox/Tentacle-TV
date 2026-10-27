/**
 * Octave — le relevé de l'ordre de la source d'une playlist importée, dans `music_playlist_sources` (règles :
 * `sourceRecord.ts`). Une ligne par playlist ; effacée avec elle (`playlistService.deletePlaylist`).
 */

import { getPrisma } from "../../services/db";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { isImportSource, parseSlots, type PlaylistSourceRecord } from "./sourceRecord";

export async function readPlaylistSource(playlistId: string): Promise<PlaylistSourceRecord | null> {
  const row = await getPrisma().musicPlaylistSource.findUnique({ where: { playlistId: normalizeId(playlistId) } });
  if (!row || !isImportSource(row.source)) return null;
  return {
    playlistId: row.playlistId,
    userId: row.userId,
    source: row.source,
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
