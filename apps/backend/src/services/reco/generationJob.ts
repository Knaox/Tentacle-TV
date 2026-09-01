import { getPrisma } from "../db";
import { awaitRebuild } from "./profileBuilder";
import { tmdbConfigured } from "../tmdb/client";
import { getCachedMetaMany, getTitleMeta, metaKey } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { facetsFromTmdb } from "./facets";
import { idfFor, idfLoadedAt, loadIdfFromDb } from "./idfStore";
import { FacetScoringStrategy } from "./scoring/facetStrategy";
import type { Candidate, ScoreBreakdown, TasteVector } from "./scoring/strategy";
import { buildExclusions } from "./candidates/exclusions";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { libraryCandidates } from "./candidates/librarySource";
import { assemblePool } from "./candidates/pool";
import { deriveSeeds } from "./candidates/seeds";
import { candidatesFromPeople } from "./candidates/peopleSource";
import { candidatesFromDiscover, candidatesFromSeeds } from "./candidates/tmdbSource";
import type { SeedRef } from "./candidates/tmdbSource";
import { candidatesFromVigie } from "./candidates/vigieSource";
import { candidatesFromAnilist } from "./candidates/anilistSource";
import { readPool as readStoredPool, writePool } from "./poolStore";

// Lecture/écriture/invalidation du pool : extraites dans poolStore, ré-exportées
// ici pour ne pas casser les importeurs historiques.
export { POOL_ROW_KEY, readPool } from "./poolStore";

/** Le haut du pré-classement enrichi en métadonnées complètes (keywords…). */
const ENRICH_TOP = 120;
/** Le haut BIBLIOTHÈQUE enrichi en plus : le pré-classement global est dominé
 *  par les candidats TMDB (facettes aux ids TMDB, comme le profil) — en mode
 *  « bibliothèque seule », on servait donc des titres jamais enrichis, sans
 *  visuels ni providers alors que leurs métas dormaient en cache. */
const LIBRARY_ENRICH_TOP = 80;
/** Appels TMDB frais au plus par génération — le cache est gratuit. */
const ENRICH_FETCH_BUDGET = 60;
/** Budget dédié aux TITRES de graines muettes — séparé de l'enrichissement :
 *  une rangée « Parce que vous avez aimé » sans titre n'existe pas. */
const SEED_META_BUDGET = 8;

export interface PoolEntry {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
}

export interface PoolPayload {
  generatedAt: string;
  strategyId: string;
  poolSize: number;
  /** Réglage au moment de la génération (debug) — additif, vieux pools sans. */
  includeVigie?: boolean;
  /** Passe rapide (bibliothèque + cache, zéro réseau) : la relève complète
   *  l'écrase — additif, un vieux pool sans le champ est complet. */
  preliminary?: boolean;
  /** Personnes aimées au moment de la génération (rangées « Avec X »). */
  people?: Array<{ personId: number; name: string }>;
  seeds: SeedRef[];
  entries: PoolEntry[];
  /** Libellés humains des facettes à IDs (« director:5655 » → nom) pour les
   *  raisons affichées. Décennies/langues/durées se localisent côté client. */
  labels: Record<string, string>;
}

// Une génération à la fois par compte — la page peut marteler, le job non.
const inFlight = new Map<string, Promise<{ poolSize: number }>>();

export async function generatePool(userId: string): Promise<{ poolSize: number }> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = doGenerate(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

/**
 * Premier pool d'un compte : la passe RAPIDE part TOUT DE SUITE — même sur un
 * profil encore vide (le classement retombe sur qualité + fraîcheur : le
 * meilleur de la bibliothèque, montrable pendant que « on explore vos
 * goûts ») — puis la fin d'une reconstruction en cours est attendue et la
 * génération complète écrase la passe rapide. UNE seule chaîne sous le
 * mutex : deux requêtes simultanées ne lancent pas deux générations, et le
 * pool complet ne fige jamais un profil vide (il suit toujours le rebuild).
 */
export async function bootstrapPool(userId: string): Promise<{ poolSize: number }> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = (async () => {
    await doGenerate(userId, true).catch(() => undefined);
    await awaitRebuild(userId);
    return doGenerate(userId);
  })().finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

async function doGenerate(userId: string, quick = false): Promise<{ poolSize: number }> {
  const prisma = getPrisma();
  if (idfLoadedAt() === 0) await loadIdfFromDb();

  const [profileRow, settingsRow, library, likedPeople] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.recoSettings.findUnique({ where: { jellyfinUserId: userId } }),
    getLibraryIndexMemo(userId),
    prisma.userLikedPerson.findMany({
      where: { jellyfinUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { personId: true, name: true },
    }),
  ]);

  let facets: Record<string, number> = {};
  try {
    facets = profileRow ? (JSON.parse(profileRow.facets) as Record<string, number>) : {};
  } catch {
    // Profil illisible : pool sur profil vide, le prochain rebuild réécrit.
  }
  const profile: TasteVector = { facets, signalCount: profileRow?.signalCount ?? 0 };
  const includeVigie = settingsRow?.includeVigie ?? true;

  const [exclusions, seeds] = await Promise.all([
    buildExclusions(userId, library),
    deriveSeeds(userId, library),
  ]);

  // Une graine hors bibliothèque absente du cache TMDB restait sans titre —
  // et sa rangée « Parce que vous avez aimé » sautait en silence. Les plus
  // fortes d'abord (les graines arrivent triées) ; passe rapide : pas de
  // réseau, la relève complète titrera.
  if (!quick) {
    let seedMetaBudget = SEED_META_BUDGET;
    for (const seed of seeds) {
      if (seed.title || seedMetaBudget <= 0) continue;
      seedMetaBudget--;
      const meta = await getTitleMeta(seed.mediaType, seed.tmdbId);
      if (meta) seed.title = meta.title;
    }
  }

  // Sources — bibliothèque d'abord (elle porte jellyfinItemId), puis les
  // découvertes. Chaque source dégrade en liste vide, jamais en erreur.
  // Bibliothèque seule : /discover et Vigie ne produisent QUE du hors
  // bibliothèque — on économise l'API. Les graines restent interrogées :
  // leurs candidats se rattachent à la bibliothèque et portent les seedKey
  // des rangées « Parce que vous avez aimé ». En passe rapide : aucune source
  // externe du tout, le réseau attendra la relève.
  // La source « personnes » tourne même en bibliothèque seule : comme les
  // graines, ses candidats peuvent se rattacher à la bibliothèque — le filtre
  // de service fait foi.
  const [fromSeeds, fromPeople, fromDiscover, fromVigie, fromAnilist] = quick
    ? [[], [], [], [], []]
    : await Promise.all([
        candidatesFromSeeds(seeds),
        candidatesFromPeople(likedPeople),
        includeVigie ? candidatesFromDiscover(profile) : Promise.resolve([]),
        includeVigie ? candidatesFromVigie() : Promise.resolve([]),
        candidatesFromAnilist(userId),
      ]);

  const pool = assemblePool([
    libraryCandidates(library),
    fromSeeds,
    fromPeople,
    fromAnilist,
    fromVigie,
    fromDiscover,
  ]);

  // Un candidat externe déjà en bibliothèque récupère son jellyfinItemId :
  // c'est lui qui décide de la navigation (fiche Jellyfin, pas fiche Vigie).
  for (const candidate of pool) {
    if (!candidate.jellyfinItemId) {
      const entry = library.byKey.get(candidate.key);
      if (entry) candidate.jellyfinItemId = entry.itemId;
    }
  }

  // Qualité : jamais de carte muette. Sans titre, ou sans image affichable
  // (affiche TMDB ou Primary Jellyfin), un candidat sort avant le classement.
  const isDisplayable = (c: Candidate): boolean => {
    if (!c.title.trim()) return false;
    if (c.posterPath) return true;
    return !!c.jellyfinItemId && library.byKey.get(c.key)?.hasPrimaryImage === true;
  };
  const kept = pool.filter((c) => !exclusions.everywhere.has(c.key) && isDisplayable(c));

  // Pré-classement sur facettes grossières, enrichissement du haut du panier
  // (cache gratuit + budget de fetchs), re-classement final.
  const strategy = new FacetScoringStrategy(idfFor);
  let scored: PoolEntry[] = kept.map((candidate) => ({
    candidate,
    breakdown: strategy.score(profile, candidate),
  }));
  scored.sort(byTotalDesc);

  const labels: Record<string, string> = {};
  const harvestLabels = (meta: TitleMeta) => {
    for (const g of meta.genres) labels[`genre:${g.id}`] = g.name;
    for (const k of meta.keywords) labels[`kw:${k.id}`] = k.name;
    for (const d of meta.directors) if (d.name) labels[`director:${d.id}`] = d.name;
    for (const a of meta.topCast) if (a.name) labels[`actor:${a.id}`] = a.name;
    for (const s of meta.studios) if (s.name) labels[`studio:${s.id}`] = s.name;
    for (const n of meta.networks) if (n.name) labels[`network:${n.id}`] = n.name;
  };
  // Libellés des facettes nommées Jellyfin (slug → intitulé d'origine).
  for (const entry of library.entries) {
    for (const g of entry.Genres ?? []) {
      labels[`genre-name:${g.trim().toLowerCase().replace(/\s+/g, "-")}`] = g;
    }
    for (const s of entry.Studios ?? []) {
      if (s.Name) labels[`studio-name:${s.Name.trim().toLowerCase().replace(/\s+/g, "-")}`] = s.Name;
    }
  }

  // Passe rapide : enrichissement au CACHE seul, pas un octet de réseau.
  let fetchBudget = !quick && tmdbConfigured() ? ENRICH_FETCH_BUDGET : 0;
  // Haut GLOBAL + haut BIBLIOTHÈQUE (cf. LIBRARY_ENRICH_TOP), dédupliqués.
  const enrichSet = new Map<string, PoolEntry>();
  for (const entry of scored.slice(0, ENRICH_TOP)) enrichSet.set(entry.candidate.key, entry);
  let libraryKept = 0;
  for (const entry of scored) {
    if (libraryKept >= LIBRARY_ENRICH_TOP) break;
    if (!entry.candidate.jellyfinItemId) continue;
    libraryKept++;
    enrichSet.set(entry.candidate.key, entry);
  }
  const enrichTop = [...enrichSet.values()];
  // Une lecture groupée du cache pour tout le panier — le budget de fetchs
  // frais sert aux absents ET aux lignes d'avant les watch/providers.
  const cachedMeta = await getCachedMetaMany(
    enrichTop.map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }))
  );
  for (const entry of enrichTop) {
    const { candidate } = entry;
    let meta = cachedMeta.get(metaKey(candidate.mediaType, candidate.tmdbId)) ?? null;
    // Méta absente OU d'avant la clé watch/providers : le budget la (re)paie —
    // c'est la mise à niveau douce du cache, jusqu'à 60 titres par génération.
    if ((!meta || meta.providers === null) && fetchBudget > 0) {
      fetchBudget--;
      meta = (await getTitleMeta(candidate.mediaType, candidate.tmdbId)) ?? meta;
    }
    if (!meta) continue;
    harvestLabels(meta);
    candidate.facets = facetsFromTmdb(meta);
    // Les visuels : un candidat bibliothèque n'en a pas, la méta les fournit.
    candidate.posterPath = candidate.posterPath ?? meta.posterPath;
    candidate.backdropPath = candidate.backdropPath ?? meta.backdropPath;
    candidate.voteAverage = meta.voteAverage ?? candidate.voteAverage;
    candidate.voteCount = meta.voteCount ?? candidate.voteCount;
    candidate.popularity = meta.popularity ?? candidate.popularity;
    candidate.year = meta.year ?? candidate.year;
    entry.breakdown = strategy.score(profile, candidate);
  }
  scored.sort(byTotalDesc);
  scored = scored.slice(0, 1000);

  const payload: PoolPayload = {
    generatedAt: new Date().toISOString(),
    strategyId: strategy.id,
    poolSize: scored.length,
    includeVigie,
    preliminary: quick,
    people: likedPeople,
    seeds,
    entries: scored,
    labels,
  };
  await writePool(userId, payload);

  return { poolSize: scored.length };
}

function byTotalDesc(a: PoolEntry, b: PoolEntry): number {
  return b.breakdown.total - a.breakdown.total || (a.candidate.key < b.candidate.key ? -1 : 1);
}

/**
 * Garantit un pool : complet → rien à faire ; préliminaire → servi tel quel
 * pendant que la relève complète tourne (« refining ») ; absent/expiré →
 * chaîne rapide+complète lancée EN FOND (la requête HTTP n'attend jamais) et
 * l'appelant sert ce qu'il a.
 */
export async function ensureFreshPool(
  userId: string
): Promise<{ status: "fresh" | "refining" | "generating"; pool: PoolPayload | null }> {
  const pool = await readStoredPool(userId);
  if (pool?.preliminary) {
    // generatePool dédoublonne sous le mutex : appel sans condition, sans risque.
    void generatePool(userId).catch((err) =>
      console.error(`[Reco] Relève du pool ${userId.slice(0, 8)}… en échec :`, err)
    );
    return { status: "refining", pool };
  }
  if (pool) return { status: "fresh", pool };
  void bootstrapPool(userId).catch((err) =>
    console.error(`[Reco] Génération du pool ${userId.slice(0, 8)}… en échec :`, err)
  );
  return { status: "generating", pool: null };
}
