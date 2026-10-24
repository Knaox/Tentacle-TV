/**
 * Octave — les LECTURES de l'index local. Rien d'un compte ici : les droits
 * se posent par-dessus (`access/musicAccess.ts`), sur des listes d'identifiants
 * — légères, même pour une grande bibliothèque.
 */

import { getPrisma } from "../../services/db";
import type { IndexKind, IndexRow } from "./indexTypes";
import { fromDb, type DbRow } from "./rowCodec";

const BATCH = 500;

export interface SearchHit {
  id: string;
  kind: IndexKind;
}

/**
 * Les éléments qui répondent à `match` (une expression de `searchQuery.ts`),
 * les plus pertinents d'abord : le nom pèse plus que l'artiste, l'artiste plus
 * que l'album (bm25 pondéré ; les deux colonnes non indexées valent 0).
 */
export async function searchIndex(match: string, limit: number): Promise<SearchHit[]> {
  const rows = await getPrisma().$queryRawUnsafe<{ id: string; kind: string }[]>(
    `SELECT "id", "kind" FROM "music_fts" WHERE "music_fts" MATCH ? ORDER BY bm25("music_fts", 0, 0, 10.0, 4.0, 2.0) LIMIT ?`,
    match,
    limit,
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind as IndexKind }));
}

export async function rowsByIds(ids: readonly string[]): Promise<Map<string, IndexRow>> {
  const out = new Map<string, IndexRow>();
  const prisma = getPrisma();
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    if (batch.length === 0) continue;
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      `SELECT * FROM "music_items" WHERE "id" IN (${batch.map(() => "?").join(", ")})`,
      ...batch,
    );
    for (const row of rows) out.set(row.id, fromDb(row));
  }
  return out;
}

export async function rowById(id: string): Promise<IndexRow | null> {
  return (await rowsByIds([id])).get(id) ?? null;
}

export type ListOrder = "name" | "recent" | "year";

const ORDER_SQL: Record<ListOrder, string> = {
  name: `"sortName" ASC, "id" ASC`,
  recent: `"dateCreated" DESC, "sortName" ASC`,
  year: `"year" DESC, "sortName" ASC`,
};

/** Les identifiants d'une sorte, dans l'ordre demandé (filtrés ensuite par les droits). */
export async function orderedIds(kind: IndexKind, order: ListOrder): Promise<string[]> {
  const rows = await getPrisma().$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_items" WHERE "kind" = ? ORDER BY ${ORDER_SQL[order]}`,
    kind,
  );
  return rows.map((r) => r.id);
}

export async function albumTracks(albumId: string): Promise<IndexRow[]> {
  const rows = await getPrisma().$queryRawUnsafe<DbRow[]>(
    `SELECT * FROM "music_items" WHERE "kind" = 'track' AND "albumId" = ?
     ORDER BY COALESCE("discNumber", 1), COALESCE("trackNumber", 9999), "sortName"`,
    albumId,
  );
  return rows.map(fromDb);
}

/** Ce que crédite un artiste (albums ou titres), par son élément Jellyfin. */
export async function creditedTo(artistId: string, kind: "album" | "track"): Promise<IndexRow[]> {
  const rows = await getPrisma().$queryRawUnsafe<DbRow[]>(
    `SELECT * FROM "music_items" WHERE "kind" = ?
       AND EXISTS (SELECT 1 FROM json_each("artistsJson") WHERE json_extract(value, '$.id') = ?)
     ORDER BY "year" DESC, "sortName" ASC`,
    kind,
    artistId,
  );
  return rows.map(fromDb);
}

export async function tracksByRecording(mbids: readonly string[]): Promise<IndexRow[]> {
  if (mbids.length === 0) return [];
  const rows = await getPrisma().$queryRawUnsafe<DbRow[]>(
    `SELECT * FROM "music_items" WHERE "kind" = 'track' AND "recordingMbid" IN (${mbids.map(() => "?").join(", ")})`,
    ...mbids,
  );
  return rows.map(fromDb);
}

export async function countsByKind(): Promise<Record<IndexKind, number>> {
  const rows = await getPrisma().$queryRawUnsafe<{ kind: string; n: number | bigint }[]>(
    `SELECT "kind", COUNT(*) AS n FROM "music_items" GROUP BY "kind"`,
  );
  const out: Record<IndexKind, number> = { track: 0, album: 0, artist: 0 };
  for (const r of rows) if (r.kind in out) out[r.kind as IndexKind] = Number(r.n);
  return out;
}

export async function replayGainJsonOf(id: string): Promise<string | null> {
  const rows = await getPrisma().$queryRawUnsafe<{ replayGainJson: string | null }[]>(
    `SELECT "replayGainJson" FROM "music_items" WHERE "id" = ?`,
    id,
  );
  return rows[0]?.replayGainJson ?? null;
}

/** L'artiste (élément Jellyfin) → son MBID, pour compléter les crédits des titres. */
export async function artistMbids(ids: readonly string[]): Promise<Map<string, string>> {
  const rows = await rowsByIds(ids);
  const out = new Map<string, string>();
  for (const [id, row] of rows) if (row.kind === "artist" && row.artistMbid) out.set(id, row.artistMbid);
  return out;
}
