/**
 * La musique gardée sur l'appareil, lue pour Octave : les titres d'un compte
 * (« Sur cet appareil »), les albums et playlists gardés en entier, et la
 * pochette, récupérée à côté du média.
 *
 * Tout est PAR COMPTE (les claims) : deux comptes partagent un fichier, chacun
 * ne voit que ce qu'il a gardé.
 */

import type { DatabaseHandle, Volume } from "./adapters";
import type { FetchBytes } from "./fetcher";
import { MAX_TILE_BYTES } from "./fetcher";
import { saveBytes } from "./meta";
import { isPublicArtUrl, isServerPath } from "./musicKeep";
import { mediaFileExists } from "./paths";
import { PREPARE_PHASE } from "./preparePhase";
import { flag, integer, integerOrNull, text, textOrNull, type Row } from "./rows";
import { FILE_COLS, mapFileRow, type DownloadStatus, type DownloadVariant } from "./store";

/** Un titre gardé, tel que la page le consomme. */
export interface KeptMusicTrack {
  fileId: number;
  itemId: string;
  trackKey: string;
  origin: "library" | "external";
  variant: DownloadVariant;
  /** Le palier de l'Allégé audio (`a256`), `null` pour l'original : la tenue à jour le compare au plan du serveur. */
  preset: string | null;
  status: DownloadStatus;
  errorCode: string | null;
  pausedByUser: boolean;
  bytesDone: number;
  expectedSize: number | null;
  /** Le serveur le prépare encore (aucun octet n'est parti) — `preparePhase.ts`. Absent : non (la liste le dit toujours). */
  preparing?: boolean;
  /** L'heure de la prochaine relance (la file du serveur l'a dite : `Retry-After`), `null` sans relance prévue. Absent : inconnue. */
  retryAt?: number | null;
  title: string;
  artist: string | null;
  album: string | null;
  albumKey: string | null;
  discNumber: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  /** La pochette sur le disque (relative à la racine), `null` tant qu'elle n'y est pas. */
  coverRel: string | null;
  /** Le chemin du serveur d'où le titre a été tiré : le repli de la lecture si la copie manque. */
  sourcePath: string | null;
  trackJson: string;
  createdAt: number;
}

/**
 * Ce qui RETIENT des titres sur l'appareil : un album ou une playlist gardés en
 * entier (dans leur ordre), ou `track` — un titre gardé seul (menu « … »), qui le
 * retient quand sa playlist le perd (tenue à jour : `apps/web/…/offline/autosync`).
 */
export type KeptCollectionKind = "album" | "playlist" | "track";

export interface KeptMusicCollection {
  key: string;
  kind: KeptCollectionKind;
  title: string;
  subtitle: string | null;
  coverItemId: string | null;
  trackKeys: string[];
  updatedAt: number;
}

function kindOf(raw: string): KeptCollectionKind {
  return raw === "playlist" || raw === "track" ? raw : "album";
}

function originOf(row: Row): "library" | "external" {
  return text(row, "origin") === "external" ? "external" : "library";
}

function mapKept(row: Row): KeptMusicTrack {
  const file = mapFileRow(row);
  return {
    fileId: file.id,
    itemId: file.itemId,
    trackKey: text(row, "track_key"),
    origin: originOf(row),
    variant: file.variant,
    preset: file.preset,
    status: file.status,
    errorCode: file.errorCode,
    pausedByUser: flag(row, "paused_by_user"),
    bytesDone: file.bytesDone,
    expectedSize: file.expectedSize,
    preparing: file.phase === PREPARE_PHASE,
    retryAt: file.nextRetryAt,
    title: text(row, "title"),
    artist: textOrNull(row, "artist"),
    album: textOrNull(row, "album"),
    albumKey: textOrNull(row, "album_key"),
    discNumber: integerOrNull(row, "disc_number"),
    trackNumber: integerOrNull(row, "track_number"),
    durationMs: integerOrNull(row, "duration_ms"),
    coverRel: textOrNull(row, "cover_rel"),
    sourcePath: file.sourcePath,
    trackJson: text(row, "track_json"),
    createdAt: integer(row, "created_at"),
  };
}

/** Les titres de musique gardés par ce compte, rangés par album puis par place. */
export function listMusicForUser(db: DatabaseHandle, userId: string): KeptMusicTrack[] {
  return db
    .prepare(
      `SELECT ${FILE_COLS}, files.paused_by_user, files.created_at, m.track_key, m.origin, m.title, m.artist,
              m.album, m.album_key, m.disc_number, m.track_number, m.duration_ms, m.cover_rel, m.track_json
       FROM files
       JOIN claims ON claims.file_id = files.id
       JOIN music_meta m ON m.item_id = files.item_id
       WHERE claims.jellyfin_user_id = ?
       ORDER BY COALESCE(m.album, ''), COALESCE(m.disc_number, 0), COALESCE(m.track_number, 0), m.title, files.id`,
    )
    .all(userId)
    .map(mapKept);
}

/** L'item d'une clé de titre gardée, ou `null` s'il n'y a pas de fiche. */
export function musicItemOfKey(db: DatabaseHandle, trackKey: string): string | null {
  const row = db.prepare("SELECT item_id FROM music_meta WHERE track_key = ?").get(trackKey);
  return row === undefined ? null : text(row, "item_id");
}

/** L'item est-il un titre de musique ? (La page des films et la réparation les écartent.) */
export function isMusicItem(db: DatabaseHandle, itemId: string): boolean {
  return db.prepare("SELECT 1 AS one FROM music_meta WHERE item_id = ?").get(itemId) !== undefined;
}

/** Garde (ou met à jour) un album ou une playlist gardés en entier. */
export function saveMusicCollection(db: DatabaseHandle, userId: string, collection: Omit<KeptMusicCollection, "updatedAt">, nowMs: number): void {
  db.prepare(
    `INSERT INTO music_collections (jellyfin_user_id, collection_key, kind, title, subtitle, cover_item_id,
                                    track_keys_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(jellyfin_user_id, collection_key) DO UPDATE SET kind = excluded.kind, title = excluded.title,
       subtitle = excluded.subtitle, cover_item_id = excluded.cover_item_id,
       track_keys_json = excluded.track_keys_json, updated_at = excluded.updated_at`,
  ).run(
    userId,
    collection.key,
    collection.kind,
    collection.title,
    collection.subtitle,
    collection.coverItemId,
    JSON.stringify(collection.trackKeys),
    nowMs,
    nowMs,
  );
}

export function deleteMusicCollection(db: DatabaseHandle, userId: string, key: string): void {
  db.prepare("DELETE FROM music_collections WHERE jellyfin_user_id = ? AND collection_key = ?").run(userId, key);
}

function parseKeys(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export function listMusicCollections(db: DatabaseHandle, userId: string): KeptMusicCollection[] {
  return db
    .prepare(
      `SELECT collection_key, kind, title, subtitle, cover_item_id, track_keys_json, updated_at
       FROM music_collections WHERE jellyfin_user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId)
    .map((row) => ({
      key: text(row, "collection_key"),
      kind: kindOf(text(row, "kind")),
      title: text(row, "title"),
      subtitle: textOrNull(row, "subtitle"),
      coverItemId: textOrNull(row, "cover_item_id"),
      trackKeys: parseKeys(text(row, "track_keys_json")),
      updatedAt: integer(row, "updated_at"),
    }));
}

/** L'extension d'une image d'après ses premiers octets ; `null` : ce n'est pas une image connue. */
function imageExt(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP" ? "webp" : null;
}

/**
 * La pochette d'un titre, posée à côté de son média (`media/<id>/cover.<ext>`)
 * si elle manque. Best-effort : une pochette absente n'empêche rien. Un chemin
 * du serveur part avec le jeton (`fetchBytes`) ; une adresse https d'un autre
 * hôte (titre hors bibliothèque) part SANS (`fetchPublic`), ou pas du tout.
 */
export async function fetchMusicCover(
  fetchBytes: FetchBytes,
  db: DatabaseHandle,
  serverUrl: string,
  volume: Volume,
  itemId: string,
  fetchPublic: FetchBytes | null = null,
): Promise<boolean> {
  const row = db.prepare("SELECT artwork_path, cover_rel FROM music_meta WHERE item_id = ?").get(itemId);
  if (row === undefined) return false;
  const current = textOrNull(row, "cover_rel");
  if (current !== null && mediaFileExists(volume, current)) return false;
  const artwork = textOrNull(row, "artwork_path");
  if (artwork === null) return false;
  const elsewhere = isPublicArtUrl(artwork);
  if (elsewhere && fetchPublic === null) return false;
  const bytes = elsewhere ? await fetchPublic!(artwork, MAX_TILE_BYTES) : isServerPath(artwork) ? await fetchBytes(`${serverUrl}${artwork}`, MAX_TILE_BYTES) : null;
  const ext = bytes === null ? null : imageExt(bytes);
  if (bytes === null || ext === null) return false;
  const rel = `media/${itemId}/cover.${ext}`;
  if (!saveBytes(volume, rel, bytes)) return false;
  db.prepare("UPDATE music_meta SET cover_rel = ? WHERE item_id = ?").run(rel, itemId);
  return true;
}
