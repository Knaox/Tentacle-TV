import { getPrisma } from "../db";
import { IDF_UNKNOWN, computeIdf } from "./idf";
import { facetsFromJellyfin, facetsFromTmdb } from "./facets";
import { getAllCachedMeta } from "../tmdb/metaCache";
import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { SignalItem } from "./signals";

// Le job quotidien écrit la table facet_idf ; les lectures passent par ce
// cache mémoire, rechargé après chaque recalcul. Une facette inconnue vaut
// IDF_UNKNOWN (« plutôt informative ») en attendant le prochain comptage.
let idfMap = new Map<string, number>();
let loadedAt = 0;

export function idfFor(key: string): number {
  return idfMap.get(key) ?? IDF_UNKNOWN;
}

export function idfLoadedAt(): number {
  return loadedAt;
}

export async function loadIdfFromDb(): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.facetIdf.findMany({ select: { facetKey: true, idf: true } });
  idfMap = new Map(rows.map((r) => [r.facetKey, r.idf]));
  loadedAt = Date.now();
  return idfMap.size;
}

const PAGE = 1000;
const PAGES_MAX = 40;

/** Balayage complet Movie+Series de la bibliothèque (facettes Jellyfin). */
async function scanLibraryFacets(): Promise<Array<Set<string>>> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return [];

  const docs: Array<Set<string>> = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const res = await fetch(
      `${url}/Items?Recursive=true&IncludeItemTypes=Movie,Series&EnableImages=false` +
        `&EnableUserData=false&Fields=Genres,Studios,ProductionYear` +
        `&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      { headers: { "X-Emby-Token": apiKey } }
    );
    if (!res.ok) break;
    const data = (await res.json()) as { Items?: SignalItem[]; TotalRecordCount?: number };
    const batch = data.Items ?? [];
    for (const item of batch) {
      docs.push(new Set(facetsFromJellyfin(item).map((f) => f.key)));
    }
    if (docs.length >= (data.TotalRecordCount ?? 0) || batch.length < PAGE) break;
  }
  return docs;
}

/**
 * Recalcule les IDF : corpus = bibliothèque Jellyfin (facettes nommées) +
 * cache de métadonnées TMDB (facettes par ID — keywords, personnes…). Les
 * deux familles se comptent ENSEMBLE : leurs espaces de clés sont disjoints
 * par préfixe, aucune collision possible. Table réécrite d'un bloc.
 */
export async function recomputeIdf(): Promise<{ facets: number; docs: number }> {
  const [libraryDocs, cachedMeta] = await Promise.all([scanLibraryFacets(), getAllCachedMeta()]);
  const tmdbDocs = cachedMeta.map((m) => new Set(facetsFromTmdb(m).map((f) => f.key)));
  const docs = [...libraryDocs, ...tmdbDocs];
  const entries = computeIdf(docs);

  const prisma = getPrisma();
  const now = new Date();
  const rows = [...entries].map(([facetKey, e]) => ({
    facetKey,
    docCount: e.docCount,
    idf: e.idf,
    computedAt: now,
  }));
  await prisma.$transaction([
    prisma.facetIdf.deleteMany({}),
    ...chunk(rows, 500).map((c) => prisma.facetIdf.createMany({ data: c })),
  ]);
  await loadIdfFromDb();
  return { facets: rows.length, docs: docs.length };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
