/**
 * Octave — le MBID d'un ARTISTE. Sans fournisseur Internet, Jellyfin ne pose
 * pas `MusicBrainzArtist` sur l'élément MusicArtist (relevé du banc, 10.11) ;
 * il est pourtant dans les tags des titres et des albums qui le créditent.
 * On le recopie donc de leurs crédits, en un passage (aucune requête à
 * Jellyfin), après un passage complet ou l'arrivée d'un artiste.
 */

import { getPrisma } from "../../services/db";
import type { IndexArtist } from "./indexTypes";

export async function fillArtistMbids(): Promise<number> {
  const prisma = getPrisma();
  const missing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_items" WHERE "kind" = 'artist' AND "artistMbid" IS NULL`,
  );
  if (missing.length === 0) return 0;
  const wanted = new Set(missing.map((r) => r.id));
  const credits = await prisma.$queryRawUnsafe<{ artistsJson: string }[]>(
    `SELECT "artistsJson" FROM "music_items" WHERE "kind" IN ('album', 'track')`,
  );
  const found = new Map<string, string>();
  for (const { artistsJson } of credits) {
    let artists: IndexArtist[];
    try {
      artists = JSON.parse(artistsJson) as IndexArtist[];
    } catch {
      continue;
    }
    for (const a of artists) if (a.id && a.mbid && wanted.has(a.id) && !found.has(a.id)) found.set(a.id, a.mbid);
  }
  for (const [id, mbid] of found) {
    await prisma.$executeRawUnsafe(`UPDATE "music_items" SET "artistMbid" = ? WHERE "id" = ?`, mbid, id);
  }
  return found.size;
}
