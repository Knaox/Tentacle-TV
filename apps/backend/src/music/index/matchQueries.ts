/**
 * Octave — les CANDIDATS d'une correspondance « est-ce dans la bibliothèque ? »
 * (`view/matchViews.ts`) : des lignes de l'index local, jamais une requête à
 * Jellyfin. Le nom seul est cherché (colonne `name` de la FTS, mots ENTIERS :
 * un titre plus long, « (feat. …) » compris, répond aussi) ; la règle
 * partagée tranche ensuite.
 */

import { getPrisma } from "../../services/db";
import { stripTitleNoise } from "../contract/musicLibraryMatch";
import type { IndexRow } from "./indexTypes";
import { fromDb, type DbRow } from "./rowCodec";
import { searchTokens } from "./searchQuery";

/** « & » n'est pas un mot pour le tokeniseur : « and » écarterait « Rock & Roll ». */
const SKIPPED = new Set(["and"]);

/** L'expression FTS5 du NOM d'un titre (`null` : rien à chercher). */
export function nameMatchExpression(title: string): string | null {
  const tokens = searchTokens(stripTitleNoise(title)).filter((t) => !SKIPPED.has(t));
  if (tokens.length === 0) return null;
  return `name : (${tokens.map((t) => `"${t}"`).join(" ")})`;
}

/** Les lignes d'une sorte dont le NOM porte tous les mots du titre (au plus `limit`). */
export async function rowsNamed(kind: "track" | "album", title: string, limit: number): Promise<IndexRow[]> {
  const match = nameMatchExpression(title);
  if (!match) return [];
  const prisma = getPrisma();
  const hits = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_fts" WHERE "music_fts" MATCH ? AND "kind" = ? LIMIT ?`,
    match,
    kind,
    limit,
  );
  if (hits.length === 0) return [];
  const rows = await prisma.$queryRawUnsafe<DbRow[]>(
    `SELECT * FROM "music_items" WHERE "id" IN (${hits.map(() => "?").join(", ")})`,
    ...hits.map((h) => h.id),
  );
  return rows.map(fromDb);
}

/** Les albums d'une parution ou d'un groupe de parutions MusicBrainz. */
export async function albumsByMbids(releases: readonly string[], groups: readonly string[]): Promise<IndexRow[]> {
  if (releases.length === 0 && groups.length === 0) return [];
  // SQLite admet une liste vide (« IN () » : faux) ; seules des marques `?` entrent dans le texte.
  const rows = await getPrisma().$queryRawUnsafe<DbRow[]>(
    `SELECT * FROM "music_items" WHERE "kind" = 'album' AND ("releaseMbid" IN (${releases.map(() => "?").join(", ")}) OR "releaseGroupMbid" IN (${groups.map(() => "?").join(", ")}))`,
    ...releases,
    ...groups,
  );
  return rows.map(fromDb);
}
