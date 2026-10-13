import { getPrisma } from "../db";
import { getCachedMetaMany } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { PRIVACY_MIN_USERS } from "./cooccurrence";
import type { PoolPayload } from "./generationJob";
import type { LibraryIndex } from "./candidates/libraryIndex";
import type { RecoRowItem } from "./rowBuilder";

const ROW_SIZE = 24;
/** Ancres maximum par compte (titres regardés/aimés dont on suit les voisins). */
const ANCHORS_MAX = 60;

/** Une paire de la table des cooccurrences, telle que la rangée la lit. */
export interface CommunityNeighbor {
  itemAKey: string;
  itemBKey: string;
  score: number;
  userCount: number;
}

/** Pur : les ancres du compte — titres vus ou favoris de la bibliothèque, puis bien notés. */
export function communityAnchors(
  library: LibraryIndex,
  goodRatings: ReadonlyArray<{ mediaType: string; tmdbId: number }>
): Set<string> {
  const anchors = new Set<string>();
  for (const entry of library.entries) {
    if (entry.played || entry.isFavorite) anchors.add(entry.key);
    if (anchors.size >= ANCHORS_MAX) break;
  }
  for (const r of goodRatings) anchors.add(`${r.mediaType === "movie" ? "movie" : "tv"}:${r.tmdbId}`);
  return anchors;
}

/** Pur : agrégation par cible — somme des scores sur toutes les ancres, seuil revérifié. */
export function rankCommunity(
  neighbors: readonly CommunityNeighbor[],
  anchors: ReadonlySet<string>,
  exclude: ReadonlySet<string>
): Array<[string, { score: number; userCount: number }]> {
  const aggregate = new Map<string, { score: number; userCount: number }>();
  for (const n of neighbors) {
    if (!anchors.has(n.itemAKey) || n.userCount < PRIVACY_MIN_USERS) continue;
    if (anchors.has(n.itemBKey) || exclude.has(n.itemBKey)) continue;
    const cur = aggregate.get(n.itemBKey);
    if (cur) {
      cur.score += n.score;
      cur.userCount = Math.max(cur.userCount, n.userCount);
    } else {
      aggregate.set(n.itemBKey, { score: n.score, userCount: n.userCount });
    }
  }
  return [...aggregate.entries()]
    .sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
    .slice(0, ROW_SIZE * 2);
}

/** Pur : l'habillage — le pool d'abord (titre, affiche), sinon la bibliothèque, sinon le cache. */
export function communityItems(
  ranked: ReadonlyArray<[string, { score: number; userCount: number }]>,
  ctx: { library: LibraryIndex; pool: PoolPayload | null; metaByKey: ReadonlyMap<string, TitleMeta>; inLibraryOnly: boolean }
): RecoRowItem[] {
  const poolByKey = new Map(ctx.pool?.entries.map((e) => [e.candidate.key, e]) ?? []);
  const items: RecoRowItem[] = [];
  for (const [key, agg] of ranked) {
    if (items.length >= ROW_SIZE) break;
    const [mediaTypeRaw, idRaw] = key.split(":");
    const mediaType = mediaTypeRaw === "tv" ? "tv" : "movie";
    const tmdbId = Number(idRaw);
    if (!Number.isFinite(tmdbId)) continue;
    const fromPool = poolByKey.get(key);
    const fromLibrary = ctx.library.byKey.get(key);
    // Bibliothèque seule : un voisin sans résolution locale ne sort pas.
    if (ctx.inLibraryOnly && !fromLibrary && !fromPool?.candidate.jellyfinItemId) continue;
    let title = fromPool?.candidate.title ?? fromLibrary?.name ?? "";
    let year = fromPool?.candidate.year ?? fromLibrary?.ProductionYear ?? null;
    let posterPath = fromPool?.candidate.posterPath ?? null;
    let backdropPath = fromPool?.candidate.backdropPath ?? null;
    let voteAverage = fromPool?.candidate.voteAverage ?? fromLibrary?.communityRating ?? null;
    if (!title) {
      const meta = ctx.metaByKey.get(key);
      if (!meta) continue; // rien d'affichable — on saute plutôt qu'une carte muette
      title = meta.title;
      year = meta.year;
      voteAverage = meta.voteAverage;
      posterPath = meta.posterPath;
      backdropPath = meta.backdropPath;
    }
    // Même exigence de qualité qu'au pool : une carte sans image ne sort pas.
    if (!posterPath && fromLibrary?.hasPrimaryImage !== true) continue;
    items.push({
      key,
      mediaType,
      tmdbId,
      title,
      year,
      posterPath,
      backdropPath,
      jellyfinItemId: fromLibrary?.itemId ?? fromPool?.candidate.jellyfinItemId ?? null,
      source: "community",
      score: agg.score,
      voteAverage,
      reasons: [],
      providers: null,
    });
  }
  return items;
}

/**
 * « Les utilisateurs de Tentacle regardent aussi » : les voisins de
 * cooccurrence des titres que CE compte a vus ou aimés. La table ne contient
 * déjà que des paires portées par >= PRIVACY_MIN_USERS comptes ; le seuil est
 * REVÉRIFIÉ ici — une ligne ancienne ou bricolée ne passe pas.
 */
export async function buildCommunityRow(
  userId: string,
  library: LibraryIndex,
  exclude: ReadonlySet<string>,
  inLibraryOnly = false,
  pool: PoolPayload | null = null
): Promise<{ key: string; items: RecoRowItem[] }> {
  const prisma = getPrisma();
  const goodRatings = await prisma.userRating.findMany({
    where: { jellyfinUserId: userId, deletedAt: null, score: { gte: 8 } },
    select: { mediaType: true, tmdbId: true },
    // `take` sans ordre : SQLite et MariaDB ne rendent pas les mêmes 40.
    orderBy: { id: "asc" },
    take: 40,
  });
  const anchors = communityAnchors(library, goodRatings);
  if (anchors.size === 0) return { key: "community", items: [] };

  const neighbors = await prisma.itemCooccurrence.findMany({
    where: { itemAKey: { in: [...anchors] }, userCount: { gte: PRIVACY_MIN_USERS } },
    orderBy: { score: "desc" },
    take: 500,
  });
  const ranked = rankCommunity(neighbors, anchors, exclude);

  // Les voisins que ni le pool ni la bibliothèque ne savent titrer : UNE
  // lecture groupée du cache, pas une requête par titre dans la boucle.
  const titled = new Set(pool?.entries.filter((e) => e.candidate.title).map((e) => e.candidate.key) ?? []);
  const unresolved: Array<{ mediaType: "movie" | "tv"; tmdbId: number }> = [];
  for (const [key] of ranked) {
    if (titled.has(key) || library.byKey.get(key)?.name) continue;
    const [t, idRaw] = key.split(":");
    const tmdbId = Number(idRaw);
    if (Number.isFinite(tmdbId)) unresolved.push({ mediaType: t === "tv" ? "tv" : "movie", tmdbId });
  }
  const metaByKey = await getCachedMetaMany(unresolved);
  return { key: "community", items: communityItems(ranked, { library, pool, metaByKey, inLibraryOnly }) };
}
