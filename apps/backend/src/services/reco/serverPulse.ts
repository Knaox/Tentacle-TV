import { getPrisma } from "../db";
import { getItemsByIds } from "../jellyfin";
import { getCachedMetaMany } from "../tmdb/metaCache";
import { canonicalKey } from "./candidates/exclusions";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { WATCH_MIN_SECONDS } from "./cooccurrence";
import { GLOBAL_CACHE_USER_ID } from "./trendingRow";
import type { BuiltRow, RecoRowItem } from "./rowBuilder";

/**
 * « Ce que les utilisateurs de Tentacle regardent » : l'agrégat GLOBAL du
 * serveur (visionnage + likes + bonnes notes), sans profil — la rangée qui
 * tient debout pour un compte neuf, quand community (cooccurrence ancrée sur
 * SES titres) n'a rien à dire.
 *
 * VIE PRIVÉE : le seuil est PULSE_MIN_ACCOUNTS = 2 comptes distincts par
 * titre, pas les 5 de la cooccurrence — et c'est voulu. Les 5 protègent des
 * PAIRES, qui fingerprintent la combinaison de goûts d'une personne ; ici on
 * publie une liste globale de titres SANS compteur. La propriété à garantir
 * est qu'aucun titre ne paraisse à cause d'un seul compte (sinon la rangée
 * serait le miroir attribuable de l'historique de quelqu'un). Deux porteurs
 * cassent l'attribution directe ; cinq tueraient la rangée sur les serveurs
 * familiaux. Jamais d'abaissement dynamique, jamais de userCount exposé.
 * Les comptes shareHistory=false sont exclus des TROIS signaux.
 */
export const SERVER_PULSE_ROW_KEY = "serverPulse";

const PULSE_MIN_ACCOUNTS = 2;
/** Fenêtre du « pouls » : 90 jours — c'est une photo du moment, pas une somme
 *  historique, et l'index (startedAt) borne le scan. */
const PULSE_WINDOW_MS = 90 * 24 * 3600_000;
const PULSE_TTL_MS = 48 * 3600_000;
const PULSE_KEEP = 48;
const ROW_SIZE = 24;
const LIKE_WEIGHT = 0.7;
const RATING_WEIGHT = 0.7;

interface PulsePayload {
  computedAt: string;
  /** Volontairement nu (clé + score) : l'habillage se fait au service, par
   *  compte, sur bibliothèque et cache — jamais de titre figé ici. */
  items: Array<{ key: string; score: number }>;
}

function addAccount(map: Map<string, Set<string>>, key: string, userId: string): void {
  const set = map.get(key);
  if (set) set.add(userId);
  else map.set(key, new Set([userId]));
}

export async function runServerPulseJob(): Promise<{ titles: number }> {
  const prisma = getPrisma();

  const optedOut = await prisma.recoSettings.findMany({
    where: { shareHistory: false },
    select: { jellyfinUserId: true },
  });
  const excluded = new Set(optedOut.map((o) => o.jellyfinUserId));

  // Visionnage : temps mesuré par (compte, titre) sur la fenêtre, la série
  // agrège ses épisodes — même lecture que la cooccurrence.
  const grouped = await prisma.watchSegment.groupBy({
    by: ["jellyfinUserId", "itemId", "seriesId"],
    _sum: { seconds: true },
    where: { startedAt: { gte: new Date(Date.now() - PULSE_WINDOW_MS) } },
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

  const watchers = new Map<string, Set<string>>();
  for (const [userId, titles] of perUserSeconds) {
    for (const [titleId, seconds] of titles) {
      if (seconds < WATCH_MIN_SECONDS) continue;
      const key = keyByJellyfinId.get(titleId);
      if (key) addAccount(watchers, key, userId);
    }
  }

  // Likes et bonnes notes : tables locales, petites — filtrage désinscrits en JS.
  const likes = await prisma.userLike.findMany({
    select: { jellyfinUserId: true, mediaType: true, tmdbId: true },
  });
  const likers = new Map<string, Set<string>>();
  for (const l of likes) {
    if (excluded.has(l.jellyfinUserId)) continue;
    addAccount(likers, canonicalKey(l.mediaType, l.tmdbId), l.jellyfinUserId);
  }
  const ratings = await prisma.userRating.findMany({
    where: { deletedAt: null, score: { gte: 8 } },
    select: { jellyfinUserId: true, mediaType: true, tmdbId: true },
  });
  const raters = new Map<string, Set<string>>();
  for (const r of ratings) {
    if (excluded.has(r.jellyfinUserId)) continue;
    addAccount(raters, canonicalKey(r.mediaType, r.tmdbId), r.jellyfinUserId);
  }

  const keys = new Set([...watchers.keys(), ...likers.keys(), ...raters.keys()]);
  const ranked: Array<{ key: string; score: number }> = [];
  for (const key of keys) {
    const w = watchers.get(key);
    const l = likers.get(key);
    const r = raters.get(key);
    const distinct = new Set([...(w ?? []), ...(l ?? []), ...(r ?? [])]);
    if (distinct.size < PULSE_MIN_ACCOUNTS) continue;
    ranked.push({
      key,
      score: (w?.size ?? 0) + LIKE_WEIGHT * (l?.size ?? 0) + RATING_WEIGHT * (r?.size ?? 0),
    });
  }
  ranked.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
  const kept = ranked.slice(0, PULSE_KEEP);

  const payload: PulsePayload = { computedAt: new Date().toISOString(), items: kept };
  await prisma.recommendationCache.upsert({
    where: {
      jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey: SERVER_PULSE_ROW_KEY },
    },
    create: {
      jellyfinUserId: GLOBAL_CACHE_USER_ID,
      rowKey: SERVER_PULSE_ROW_KEY,
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + PULSE_TTL_MS),
    },
    update: {
      payload: JSON.stringify(payload),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + PULSE_TTL_MS),
    },
  });
  return { titles: kept.length };
}

async function readPulsePayload(): Promise<PulsePayload | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: {
      jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey: SERVER_PULSE_ROW_KEY },
    },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.payload) as PulsePayload;
  } catch {
    return null;
  }
}

/**
 * Sert la rangée pour UN compte : lecture seule, zéro réseau. Habillage par
 * la bibliothèque du demandeur sinon le cache de métadonnées, sinon le titre
 * ne sort pas (jamais de carte muette). Pas de `pending` : la matière dépend
 * des données locales du serveur, pas d'un fetch imminent.
 */
export async function buildServerPulseRow(
  userId: string,
  ctx: { exclude: ReadonlySet<string>; includeVigie: boolean }
): Promise<BuiltRow> {
  const payload = await readPulsePayload();
  const generatedAt = payload?.computedAt ?? new Date().toISOString();
  if (!payload) return { key: SERVER_PULSE_ROW_KEY, items: [], generatedAt };

  const library = await getLibraryIndexMemo(userId);
  const missing: Array<{ mediaType: "movie" | "tv"; tmdbId: number }> = [];
  for (const { key } of payload.items) {
    if (library.byKey.has(key)) continue;
    const [t, idRaw] = key.split(":");
    const tmdbId = Number(idRaw);
    if (Number.isFinite(tmdbId)) missing.push({ mediaType: t === "tv" ? "tv" : "movie", tmdbId });
  }
  const metaByKey = await getCachedMetaMany(missing);

  const items: RecoRowItem[] = [];
  for (const { key, score } of payload.items) {
    if (items.length >= ROW_SIZE) break;
    if (ctx.exclude.has(key)) continue;
    const entry = library.byKey.get(key);
    if (entry && (entry.played || entry.inProgress || entry.isFavorite)) continue;
    if (!ctx.includeVigie && !entry) continue;
    const [mediaTypeRaw, idRaw] = key.split(":");
    const mediaType = mediaTypeRaw === "tv" ? "tv" : "movie";
    const tmdbId = Number(idRaw);
    if (!Number.isFinite(tmdbId)) continue;
    const meta = metaByKey.get(key);
    const title = entry?.name ?? meta?.title ?? "";
    if (!title) continue;
    const posterPath = meta?.posterPath ?? null;
    if (!posterPath && entry?.hasPrimaryImage !== true) continue;
    items.push({
      key,
      mediaType,
      tmdbId,
      title,
      year: entry?.ProductionYear ?? meta?.year ?? null,
      posterPath,
      backdropPath: meta?.backdropPath ?? null,
      jellyfinItemId: entry?.itemId ?? null,
      source: "serverPulse",
      score,
      voteAverage: entry?.communityRating ?? meta?.voteAverage ?? null,
      reasons: [],
    });
  }
  return { key: SERVER_PULSE_ROW_KEY, items, generatedAt };
}
