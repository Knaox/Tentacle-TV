import { getPrisma } from "../db";
import { getCachedMeta } from "../tmdb/metaCache";
import { PRIVACY_MIN_USERS } from "./cooccurrence";
import { readPool } from "./generationJob";
import type { LibraryIndex } from "./candidates/libraryIndex";
import type { RecoRowItem } from "./rowBuilder";

const ROW_SIZE = 24;
/** Ancres maximum par compte (titres regardés/aimés dont on suit les voisins). */
const ANCHORS_MAX = 60;

/**
 * « Les utilisateurs de Tentacle regardent aussi » : les voisins de
 * cooccurrence des titres que CE compte a vus ou aimés. La table ne contient
 * déjà que des paires portées par >= PRIVACY_MIN_USERS comptes ; le seuil est
 * REVÉRIFIÉ ici — une ligne ancienne ou bricolée ne passe pas.
 */
export async function buildCommunityRow(
  userId: string,
  library: LibraryIndex,
  exclude: ReadonlySet<string>
): Promise<{ key: string; items: RecoRowItem[] }> {
  const prisma = getPrisma();

  // Ancres : titres vus (bibliothèque) + notés fort + favoris.
  const anchors = new Set<string>();
  for (const entry of library.entries) {
    if (entry.played || entry.isFavorite) anchors.add(entry.key);
    if (anchors.size >= ANCHORS_MAX) break;
  }
  const goodRatings = await prisma.userRating.findMany({
    where: { jellyfinUserId: userId, deletedAt: null, score: { gte: 8 } },
    select: { mediaType: true, tmdbId: true },
    take: 40,
  });
  for (const r of goodRatings) {
    anchors.add(`${r.mediaType === "movie" ? "movie" : "tv"}:${r.tmdbId}`);
  }
  if (anchors.size === 0) return { key: "community", items: [] };

  const neighbors = await prisma.itemCooccurrence.findMany({
    where: { itemAKey: { in: [...anchors] }, userCount: { gte: PRIVACY_MIN_USERS } },
    orderBy: { score: "desc" },
    take: 500,
  });

  // Agrégation par cible : somme des scores sur toutes les ancres.
  const aggregate = new Map<string, { score: number; userCount: number }>();
  for (const n of neighbors) {
    if (anchors.has(n.itemBKey) || exclude.has(n.itemBKey)) continue;
    const cur = aggregate.get(n.itemBKey);
    if (cur) {
      cur.score += n.score;
      cur.userCount = Math.max(cur.userCount, n.userCount);
    } else {
      aggregate.set(n.itemBKey, { score: n.score, userCount: n.userCount });
    }
  }

  const ranked = [...aggregate.entries()]
    .sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
    .slice(0, ROW_SIZE * 2);

  // Habillage : le pool d'abord (titre, affiche, raison), sinon la
  // bibliothèque, sinon le cache de métadonnées — jamais d'appel réseau ici.
  const pool = await readPool(userId);
  const poolByKey = new Map(pool?.entries.map((e) => [e.candidate.key, e]) ?? []);

  const items: RecoRowItem[] = [];
  for (const [key, agg] of ranked) {
    if (items.length >= ROW_SIZE) break;
    const [mediaTypeRaw, idRaw] = key.split(":");
    const mediaType = mediaTypeRaw === "tv" ? "tv" : "movie";
    const tmdbId = Number(idRaw);
    if (!Number.isFinite(tmdbId)) continue;

    const fromPool = poolByKey.get(key);
    const fromLibrary = library.byKey.get(key);
    let title = fromPool?.candidate.title ?? fromLibrary?.name ?? "";
    let year = fromPool?.candidate.year ?? fromLibrary?.ProductionYear ?? null;
    let posterPath = fromPool?.candidate.posterPath ?? null;
    let voteAverage = fromPool?.candidate.voteAverage ?? fromLibrary?.communityRating ?? null;
    if (!title) {
      const meta = await getCachedMeta(mediaType, tmdbId);
      if (!meta) continue; // rien d'affichable — on saute plutôt qu'une carte muette
      title = meta.title;
      year = meta.year;
      voteAverage = meta.voteAverage;
    }

    items.push({
      key,
      mediaType,
      tmdbId,
      title,
      year,
      posterPath,
      jellyfinItemId: fromLibrary?.itemId ?? fromPool?.candidate.jellyfinItemId ?? null,
      source: "community",
      score: agg.score,
      voteAverage,
      reasons: [],
    });
  }

  return { key: "community", items };
}
