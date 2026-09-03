import { getPrisma } from "../db";
import { getCachedMetaMany } from "../tmdb/metaCache";
import { PRIVACY_MIN_USERS } from "./cooccurrence";
import type { PoolPayload } from "./generationJob";
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
  exclude: ReadonlySet<string>,
  inLibraryOnly = false,
  pool: PoolPayload | null = null
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
  // Le pool est fourni par l'appelant (lu UNE fois par service de page).
  const poolByKey = new Map(pool?.entries.map((e) => [e.candidate.key, e]) ?? []);

  // Les voisins que ni le pool ni la bibliothèque ne savent titrer : UNE
  // lecture groupée du cache, pas une requête par titre dans la boucle.
  const unresolved: Array<{ mediaType: "movie" | "tv"; tmdbId: number }> = [];
  for (const [key] of ranked) {
    if (poolByKey.get(key)?.candidate.title || library.byKey.get(key)?.name) continue;
    const [t, idRaw] = key.split(":");
    const tmdbId = Number(idRaw);
    if (Number.isFinite(tmdbId)) unresolved.push({ mediaType: t === "tv" ? "tv" : "movie", tmdbId });
  }
  const metaByKey = await getCachedMetaMany(unresolved);

  const items: RecoRowItem[] = [];
  for (const [key, agg] of ranked) {
    if (items.length >= ROW_SIZE) break;
    const [mediaTypeRaw, idRaw] = key.split(":");
    const mediaType = mediaTypeRaw === "tv" ? "tv" : "movie";
    const tmdbId = Number(idRaw);
    if (!Number.isFinite(tmdbId)) continue;

    const fromPool = poolByKey.get(key);
    const fromLibrary = library.byKey.get(key);
    // Bibliothèque seule : un voisin sans résolution locale ne sort pas.
    if (inLibraryOnly && !fromLibrary && !fromPool?.candidate.jellyfinItemId) continue;
    let title = fromPool?.candidate.title ?? fromLibrary?.name ?? "";
    let year = fromPool?.candidate.year ?? fromLibrary?.ProductionYear ?? null;
    let posterPath = fromPool?.candidate.posterPath ?? null;
    let backdropPath = fromPool?.candidate.backdropPath ?? null;
    let voteAverage = fromPool?.candidate.voteAverage ?? fromLibrary?.communityRating ?? null;
    if (!title) {
      const meta = metaByKey.get(key);
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

  return { key: "community", items };
}
