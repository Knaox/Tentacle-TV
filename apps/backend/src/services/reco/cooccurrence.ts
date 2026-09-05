import { getPrisma } from "../db";
import { getItemsByIds } from "../jellyfin";

/**
 * Filtrage collaboratif ITEM-ITEM : avec quelques dizaines d'utilisateurs par
 * serveur, la similarité user-user est du bruit statistique — la cooccurrence
 * de visionnage entre paires de titres, normalisée par leur popularité
 * (Jaccard), tient. Job planifié, jamais de calcul à la volée.
 *
 * VIE PRIVÉE, non négociable : une paire portée par moins de
 * PRIVACY_MIN_USERS comptes n'est JAMAIS écrite — sur un serveur familial,
 * une paire d'un seul utilisateur révèle ce qu'il regarde. Les comptes
 * désinscrits (reco_settings.shareHistory = false) sont exclus du corpus.
 */

export const PRIVACY_MIN_USERS = 5;

/** Vingt minutes mesurées = « a regardé » (les durées Jellyfin manquent trop
 *  souvent pour un seuil en pourcentage fiable). Partagé avec le pouls serveur
 *  (serverPulse) : une seule définition de « regardé » dans le moteur. */
export const WATCH_MIN_SECONDS = 1200;

/** Titres retenus par compte (les plus regardés) — borne l'explosion de paires. */
const TITLES_PER_USER_MAX = 200;

/** Paires conservées en table, meilleures d'abord. */
const PAIRS_MAX = 20_000;

export interface CooccurrenceStats {
  users: number;
  optedOut: number;
  titles: number;
  pairsKept: number;
}

export async function runCooccurrenceJob(): Promise<CooccurrenceStats> {
  const prisma = getPrisma();

  const optedOut = await prisma.recoSettings.findMany({
    where: { shareHistory: false },
    select: { jellyfinUserId: true },
  });
  const excluded = new Set(optedOut.map((o) => o.jellyfinUserId));

  // Temps mesuré par (compte, titre) — la série agrège ses épisodes.
  const grouped = await prisma.watchSegment.groupBy({
    by: ["jellyfinUserId", "itemId", "seriesId"],
    _sum: { seconds: true },
  });

  const perUserSeconds = new Map<string, Map<string, number>>();
  const jellyfinIds = new Set<string>();
  for (const row of grouped) {
    if (excluded.has(row.jellyfinUserId)) continue;
    const titleId = row.seriesId ?? row.itemId;
    jellyfinIds.add(titleId);
    let titles = perUserSeconds.get(row.jellyfinUserId);
    if (!titles) perUserSeconds.set(row.jellyfinUserId, (titles = new Map()));
    titles.set(titleId, (titles.get(titleId) ?? 0) + (row._sum.seconds ?? 0));
  }

  // Résolution id Jellyfin → clé canonique movie:/tv: (lots de 100, clé admin).
  const keyByJellyfinId = new Map<string, string>();
  const ids = [...jellyfinIds];
  for (let i = 0; i < ids.length; i += 100) {
    const items = await getItemsByIds(ids.slice(i, i + 100));
    for (const item of items) {
      if (!item.tmdbId) continue;
      const t = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
      if (t) keyByJellyfinId.set(item.Id, `${t}:${item.tmdbId}`);
    }
  }

  // Ensembles binaires de visionnage par compte, bornés.
  const userSets: Array<Set<string>> = [];
  for (const titles of perUserSeconds.values()) {
    const kept = [...titles.entries()]
      .filter(([, seconds]) => seconds >= WATCH_MIN_SECONDS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TITLES_PER_USER_MAX)
      .map(([id]) => keyByJellyfinId.get(id))
      .filter((k): k is string => !!k);
    if (kept.length >= 2) userSets.push(new Set(kept));
  }

  // Comptage des paires (ordre canonique a < b) et des porteurs par titre.
  const pairCount = new Map<string, number>();
  const itemCount = new Map<string, number>();
  for (const set of userSets) {
    const keys = [...set].sort();
    for (const key of keys) itemCount.set(key, (itemCount.get(key) ?? 0) + 1);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pair = `${keys[i]}|${keys[j]}`;
        pairCount.set(pair, (pairCount.get(pair) ?? 0) + 1);
      }
    }
  }

  const now = new Date();
  const rows: Array<{ itemAKey: string; itemBKey: string; score: number; userCount: number; computedAt: Date }> = [];
  for (const [pair, co] of pairCount) {
    if (co < PRIVACY_MIN_USERS) continue;
    const [a, b] = pair.split("|");
    const union = (itemCount.get(a) ?? co) + (itemCount.get(b) ?? co) - co;
    const score = union > 0 ? co / union : 0;
    // Les DEUX sens sont écrits : la lecture se fait toujours par itemAKey.
    rows.push({ itemAKey: a, itemBKey: b, score, userCount: co, computedAt: now });
    rows.push({ itemAKey: b, itemBKey: a, score, userCount: co, computedAt: now });
  }
  rows.sort((x, y) => y.score - x.score);
  const kept = rows.slice(0, PAIRS_MAX * 2);

  await prisma.$transaction([
    prisma.itemCooccurrence.deleteMany({}),
    ...chunk(kept, 500).map((c) => prisma.itemCooccurrence.createMany({ data: c })),
  ]);

  return {
    users: userSets.length,
    optedOut: excluded.size,
    titles: itemCount.size,
    pairsKept: kept.length / 2,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
