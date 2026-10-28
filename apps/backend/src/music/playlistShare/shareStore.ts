/**
 * Octave — les liens de partage des playlists (`music_playlist_shares`) : UN lien par playlist et par compte,
 * jeton de 16 octets tirés au hasard (base64url, 22 caractères : 2¹²⁸ possibilités, rien ne s'énumère sous la
 * limite de débit de la route publique). Révoquer supprime la ligne : le lien ne sert plus rien, et un nouveau
 * partage tire un AUTRE jeton.
 */

import { randomBytes } from "crypto";
import { getPrisma } from "../../services/db";

export interface ShareRecord {
  token: string;
  playlistId: string;
  ownerUserId: string;
  ownerName: string;
  createdAt: number;
}

/** Identifiants Jellyfin comparés sans tirets ni casse (la base les garde ainsi). */
export function foldId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function newShareToken(): string {
  return randomBytes(16).toString("base64url");
}

type Row = { token: string; playlistId: string; ownerUserId: string; ownerName: string; createdAt: Date };

const record = (row: Row): ShareRecord => ({ ...row, createdAt: row.createdAt.getTime() });

export async function shareOf(ownerUserId: string, playlistId: string): Promise<ShareRecord | null> {
  const row = await getPrisma().musicPlaylistShare.findUnique({
    where: { ownerUserId_playlistId: { ownerUserId: foldId(ownerUserId), playlistId: foldId(playlistId) } },
  });
  return row ? record(row) : null;
}

/** Le lien de cette playlist : celui qui existe, sinon un nouveau. */
export async function ensureShare(ownerUserId: string, ownerName: string, playlistId: string): Promise<ShareRecord> {
  const key = { ownerUserId: foldId(ownerUserId), playlistId: foldId(playlistId) };
  const row = await getPrisma().musicPlaylistShare.upsert({
    where: { ownerUserId_playlistId: key },
    create: { token: newShareToken(), ownerName: ownerName.slice(0, 100), ...key },
    update: {},
  });
  return record(row);
}

export async function revokeShare(ownerUserId: string, playlistId: string): Promise<void> {
  await getPrisma().musicPlaylistShare.deleteMany({ where: { ownerUserId: foldId(ownerUserId), playlistId: foldId(playlistId) } });
}

export async function shareByToken(token: string): Promise<ShareRecord | null> {
  const row = await getPrisma().musicPlaylistShare.findUnique({ where: { token } });
  return row ? record(row) : null;
}

/** Une playlist supprimée : ses liens partent avec elle. */
export async function forgetPlaylistShares(playlistId: string): Promise<void> {
  await getPrisma().musicPlaylistShare.deleteMany({ where: { playlistId: foldId(playlistId) } });
}
