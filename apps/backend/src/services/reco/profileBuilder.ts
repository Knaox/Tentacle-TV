import { getPrisma } from "../db";
import { AttemptGate } from "./attemptGate";
import { emitProfileRebuilt } from "./recoEvents";
import { getCachedMetaMany, getTitleMeta } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { ANIME_UNIVERSE_KEY, facetsFromJellyfin, facetsFromTmdb } from "./facets";
import type { FacetEntry } from "./facets";
import { ratingStats, truncateVector } from "./profileMath";
import { fetchUserSignals } from "./signals";
import { idfFor, idfLoadedAt, loadIdfFromDb } from "./idfStore";
import { buildAnchors } from "./anchors";
import type { Anchor } from "./anchors";
import { measuredViewings, serializeAnchors, serializePotentials } from "./anchorStore";
import type { StoredAnchor } from "./anchorStore";
import { potentialsOf } from "./potentials";
import { buildCentroid, consumptionShares, universeShareOf } from "./tasteModel";

/** Appels TMDB au plus par reconstruction : le reste passe par le cache ou le
 *  repli Jellyfin — la reconstruction suivante reprendra où celle-ci s'arrête. */
const TMDB_FETCH_BUDGET = 40;
/** Ancres positives les plus fortes dont la fiche doit porter ses voisins
 *  collaboratifs (mise à niveau du cache, sous le même budget). */
const NEIGHBORS_UPGRADE_TOP = 150;
const PROFILE_MAX_FACETS = 400;
/** Version du profil stocké : 2 = animeShare, 3 = notes sur l'échelle absolue
 *  (point neutre 6,5), 4 = ancres du goût (facettes et poids refondus),
 *  5 = Ma liste hors du goût (les titres seulement listés sont des
 *  potentiels) et un seul « j'aime » par titre. Le fan-out de boot
 *  reconstruit une fois les profils d'une version antérieure. */
export const PROFILE_SCHEMA_VERSION = 5;

// Une reconstruction à la fois par compte : les pokes en rafale s'écrasent.
const inFlight = new Map<string, Promise<ProfileSummary>>();

/** Garde de FRÉQUENCE des relances déclenchées par une requête (premier
 *  contact sans ligne de profil) : Jellyfin muet, le rebuild échoue — sans
 *  elle, chaque requête d'un client qui sonde relançait dix secondes de
 *  scans. Deux minutes entre deux tentatives ; un succès la rend sans objet
 *  (la ligne existe). Les jobs (poke, fan-out) ne passent pas par elle. */
export const profileRebuildGate = new AttemptGate(2 * 60_000);

export interface ProfileSummary {
  signalCount: number;
  facetCount: number;
  ratingMean: number;
  ratingStdDev: number;
  /** Part d'animé dans le temps de visionnage (0..1). */
  animeShare: number;
}

export async function rebuildProfile(userId: string): Promise<ProfileSummary> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = doRebuild(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

/** Une reconstruction est-elle en cours pour ce compte ? (endpoint de statut) */
export function isRebuilding(userId: string): boolean {
  return inFlight.has(userId);
}

/** La reconstruction en cours, s'il y en a une — la chaîne du pool s'y adosse
 *  pour ne jamais générer sur un profil encore vide. Ne rejette jamais. */
export function awaitRebuild(userId: string): Promise<unknown> {
  const pending = inFlight.get(userId);
  return pending ? pending.catch(() => undefined) : Promise.resolve();
}

async function doRebuild(userId: string): Promise<ProfileSummary> {
  const prisma = getPrisma();
  if (idfLoadedAt() === 0) await loadIdfFromDb();

  const [ratings, likes, feedback, swipes, pendingWatchlist, signals, measured] = await Promise.all([
    prisma.userRating.findMany({ where: { jellyfinUserId: userId, deletedAt: null } }),
    prisma.userLike.findMany({ where: { jellyfinUserId: userId } }),
    prisma.recommendationFeedback.findMany({ where: { jellyfinUserId: userId } }),
    // « Passé » ne juge rien : il n'entre pas dans le goût.
    prisma.userSwipe.findMany({ where: { jellyfinUserId: userId, verdict: { not: "skip" } } }),
    // Ma liste d'un titre absent : un potentiel, comme Ma liste en bibliothèque.
    prisma.watchlistPending.findMany({
      where: { jellyfinUserId: userId, flag: "watchlist" },
      select: { mediaType: true, tmdbId: true },
    }),
    fetchUserSignals(userId),
    measuredViewings(userId).catch(() => new Map()),
  ]);

  const { mean, stdDev } = ratingStats(ratings.map((r) => r.score));
  const anchorSet = buildAnchors({
    now: Date.now(),
    ratings,
    likes,
    feedback,
    swipes,
    favorites: signals.favorites,
    playedMovies: signals.playedMovies,
    resumable: signals.resumable,
    playedEpisodes: signals.playedEpisodes,
    seriesById: signals.seriesById,
    measured,
  });
  const { anchors, itemByKey } = anchorSet;
  // Ma liste n'est pas un goût : ce qui n'y est que listé reste un potentiel.
  const potentials = potentialsOf(anchorSet, signals.watchlist, pendingWatchlist);

  // Fiches TMDB des ancres : cache gratuit, budget de fetchs pour les plus
  // fortes (absentes, ou sans voisins collaboratifs).
  const metaByKey = await resolveAnchorMeta(anchors);
  const facetsByKey = new Map<string, FacetEntry[]>();
  const stored: StoredAnchor[] = [];
  for (const a of anchors) {
    const meta = metaByKey.get(a.key);
    const fallback = itemByKey.get(a.key);
    const facets = meta ? facetsFromTmdb(meta) : fallback ? facetsFromJellyfin(fallback) : [];
    if (facets.length === 0) continue;
    if (!a.title && meta) a.title = meta.title;
    facetsByKey.set(a.key, facets);
    // Les facettes de repli voyagent avec l'ancre : TMDB ne les connaît pas.
    stored.push(meta ? a : { ...a, facets });
  }

  const facetsOf = (a: Anchor) => facetsByKey.get(a.key) ?? null;
  const shares = consumptionShares(stored);
  const vector = truncateVector(buildCentroid(stored, facetsOf, idfFor, shares), PROFILE_MAX_FACETS);
  const facetCount = Object.keys(vector).length;
  // Part d'animé en TEMPS DE VISIONNAGE sur les ancres de CONSOMMATION : c'est
  // ce qu'on REGARDE qui décide, pas ce qu'on met en favori.
  const animeShare = universeShareOf(stored, (a) =>
    (facetsOf(a) ?? []).some((f) => f.key === ANIME_UNIVERSE_KEY)
  );
  // Compte de signaux (et non d'ancres) : les seuils froid/tiède du service
  // gardent leur sens — un titre vu, noté et en favori, c'est trois signaux.
  const signalCount = stored.reduce((s, a) => s + a.kinds.length, 0);

  const data = {
    facets: JSON.stringify(vector),
    anchors: serializeAnchors(stored),
    potentials: serializePotentials(potentials),
    signalCount,
    ratingMean: mean,
    ratingStdDev: stdDev,
    animeShare,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
  await prisma.tasteProfile.upsert({
    where: { jellyfinUserId: userId },
    create: { jellyfinUserId: userId, ...data },
    update: { ...data, computedAt: new Date() },
  });
  emitProfileRebuilt(userId);

  return { signalCount, facetCount, ratingMean: mean, ratingStdDev: stdDev, animeShare };
}

/**
 * Fiches des ancres : une lecture groupée du cache, puis le budget de fetchs
 * TMDB — d'abord les ancres sans fiche (les plus fortes en tête), puis la
 * mise à niveau des fortes dont la fiche ne porte pas encore ses voisins
 * collaboratifs. La reconstruction suivante reprend où celle-ci s'arrête.
 */
async function resolveAnchorMeta(anchors: readonly Anchor[]): Promise<Map<string, TitleMeta>> {
  const withTmdb = anchors.filter((a) => a.tmdbId > 0);
  const out = await getCachedMetaMany(withTmdb.map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId })));
  const byStrength = withTmdb.slice().sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight));
  const misses = byStrength.filter((a) => !out.has(a.key));
  const upgrades = byStrength
    .filter((a) => a.weight > 0)
    .slice(0, NEIGHBORS_UPGRADE_TOP)
    .filter((a) => {
      const meta = out.get(a.key);
      return !!meta && meta.recommendations == null;
    });
  let budget = TMDB_FETCH_BUDGET;
  for (const a of [...misses, ...upgrades]) {
    if (budget <= 0) break;
    budget--;
    const meta = await getTitleMeta(a.mediaType, a.tmdbId, { priority: "background", upgrade: true });
    if (meta) out.set(a.key, meta);
  }
  return out;
}
