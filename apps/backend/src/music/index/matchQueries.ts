/**
 * Octave — les CANDIDATS d'une correspondance « est-ce dans la bibliothèque ? »
 * (`view/matchViews.ts`) : des lignes de l'index local, jamais une requête à
 * Jellyfin. Le nom est cherché (colonne `name` de la FTS, mots ENTIERS : un
 * titre plus long, « (feat. …) » compris, répond aussi), resserré au besoin
 * sur l'un des artistes du crédit (colonne `artists`) ; la règle partagée
 * tranche ensuite. Les candidats sont RANGÉS, le nom le plus COURT d'abord
 * (celui qui n'a que ces mots) : sans ordre, un titre courant (« lovely »,
 * « Home ») pouvait laisser le bon hors des quarante premiers. Jamais bm25 :
 * il juge la ligne entière, et un recueil (« Various Artists », long titre
 * d'album) y passait derrière quarante « Lovely Day » (mesuré).
 */

import { getPrisma } from "../../services/db";
import { isVariousCredit, stripTitleNoise, type MatchArtist } from "../contract/musicLibraryMatch";
import type { IndexRow } from "./indexTypes";
import { fromDb, type DbRow } from "./rowCodec";
import { searchTokens } from "./searchQuery";

/** « & » n'est pas un mot pour le tokeniseur : « and » écarterait « Rock & Roll ». */
const SKIPPED = new Set(["and"]);

const quoted = (tokens: readonly string[]) => tokens.map((t) => `"${t}"`).join(" ");

/** L'expression FTS5 du NOM d'un titre (`null` : rien à chercher). */
export function nameMatchExpression(title: string): string | null {
  const tokens = searchTokens(stripTitleNoise(title)).filter((t) => !SKIPPED.has(t));
  if (tokens.length === 0) return null;
  return `name : (${quoted(tokens)})`;
}

/**
 * Le nom ET l'un des mots du crédit dans `artists` (« Stromae & Pomme » : stromae OU pomme) — des mots, pas des
 * noms entiers : la FTS coupe « D'Angelo » en d + angelo, qu'un nom normalisé (« dangelo ») ne retrouverait pas.
 * `null` sans artiste qui dise quelque chose (crédit vide, « Various Artists ») : le nom seul suffit alors.
 */
export function creditedMatchExpression(title: string, artists: readonly MatchArtist[]): string | null {
  const name = nameMatchExpression(title);
  if (!name || isVariousCredit(artists)) return null;
  const words = [...new Set(artists.flatMap((a) => searchTokens(a.name)).filter((t) => !SKIPPED.has(t)))];
  if (words.length === 0) return null;
  return `${name} AND artists : (${words.slice(0, 16).map((t) => `"${t}"`).join(" OR ")})`;
}

/** Les lignes d'une sorte dont le NOM porte tous les mots du titre (au plus `limit`), resserrées par `artists`. */
export async function rowsNamed(kind: "track" | "album", title: string, limit: number, artists?: readonly MatchArtist[]): Promise<IndexRow[]> {
  const match = artists ? creditedMatchExpression(title, artists) : nameMatchExpression(title);
  if (!match) return [];
  const prisma = getPrisma();
  const hits = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "music_fts" WHERE "music_fts" MATCH ? AND "kind" = ? ORDER BY length("name"), "id" LIMIT ?`,
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

/** Une recherche de `rowsNamed` : le titre, et le crédit qui la resserre (absent : le nom seul). */
export interface NamedSearch {
  title: string;
  artists?: readonly MatchArtist[];
}

/** Recherches par requête SQL (≤ 500 sélections composées dans SQLite) et identifiants par `IN` (≤ 32 766 variables). */
const SEARCHES_PER_QUERY = 200;
const IDS_PER_QUERY = 900;

/**
 * PLUSIEURS recherches de `rowsNamed` d'un coup (lot « pg », 10/11 : un import de 9 000 titres en faisait 36 000,
 * 8,7 s mesurées, l'aller-retour de Prisma bien plus que la FTS). Mêmes candidats, même ordre de rang, même borne,
 * et les lignes de chaque recherche dans l'ordre que rend `rowsNamed` (identifiant croissant, celui du `IN`).
 */
export async function rowsNamedMany(kind: "track" | "album", searches: readonly NamedSearch[], limit: number): Promise<IndexRow[][]> {
  const out: IndexRow[][] = searches.map(() => []);
  const live = searches.flatMap((search, at) => {
    const match = search.artists ? creditedMatchExpression(search.title, search.artists) : nameMatchExpression(search.title);
    return match ? [{ at, match }] : [];
  });
  const prisma = getPrisma();
  const hits: { q: number; id: string }[] = [];
  for (let i = 0; i < live.length; i += SEARCHES_PER_QUERY) {
    const part = live.slice(i, i + SEARCHES_PER_QUERY);
    const sql = part
      .map(() => `SELECT * FROM (SELECT ? AS "q", "id" FROM "music_fts" WHERE "music_fts" MATCH ? AND "kind" = ? ORDER BY length("name"), "id" LIMIT ?)`)
      .join(" UNION ALL ");
    hits.push(...(await prisma.$queryRawUnsafe<{ q: number | bigint; id: string }[]>(sql, ...part.flatMap((p) => [p.at, p.match, kind, limit]))).map((h) => ({ q: Number(h.q), id: h.id })));
  }
  const ids = [...new Set(hits.map((h) => h.id))];
  const rows = new Map<string, IndexRow>();
  for (let i = 0; i < ids.length; i += IDS_PER_QUERY) {
    const part = ids.slice(i, i + IDS_PER_QUERY);
    for (const row of await prisma.$queryRawUnsafe<DbRow[]>(`SELECT * FROM "music_items" WHERE "id" IN (${part.map(() => "?").join(", ")})`, ...part)) {
      const decoded = fromDb(row);
      rows.set(decoded.id, decoded);
    }
  }
  for (const hit of hits) {
    const row = rows.get(hit.id);
    if (row) out[hit.q]!.push(row);
  }
  for (const list of out) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
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
