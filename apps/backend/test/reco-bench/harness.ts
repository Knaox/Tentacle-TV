/**
 * Le banc fait tourner le VRAI moteur pour un persona : profil (profileCompute),
 * pool (poolCompute), page (buildPageSnapshot) — sur la vraie bibliothèque
 * relevée et le vrai cache TMDB de `data/tentacle.db`, TMDB rejoué depuis la
 * bande. Le pouls du serveur et la communauté se calculent sur la POPULATION
 * des personas, jamais sur les vrais comptes. Vigie est émulée par les listes
 * TMDB qu'elle sert (découverte par popularité, tendances).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getJellyfinApiKey, getJellyfinUrl } from "../../src/services/configStore";
import { jellyfinAuthHeaders } from "../../src/services/jellyfinAuth";
import { tmdbFetch } from "../../src/services/tmdb/client";
import { getCachedMetaMany } from "../../src/services/tmdb/metaCache";
import type { TitleMeta } from "../../src/services/tmdb/metaCache";
import { libraryExclusionKeys } from "../../src/services/reco/candidates/exclusions";
import { isReleasedResult } from "../../src/services/reco/candidates/released";
import { toCandidate } from "../../src/services/reco/candidates/tmdbSource";
import { candidatesFromVigieDiscover, tmdbDiscoverParams } from "../../src/services/reco/candidates/vigieDiscover";
import type { SeerrQuery } from "../../src/services/reco/candidates/vigieDiscover";
import type { SeerrPage } from "../../src/services/reco/candidates/vigieSource";
import { cappedReleaseParams } from "../../src/services/reco/candidates/released";
import { titleLanguageParams } from "../../src/services/reco/titleLanguage";
import type { TasteVector } from "../../src/services/reco/scoring/strategy";
import type { TmdbListResult } from "../../src/services/reco/candidates/tmdbSource";
import { communityAnchors, communityItems, rankCommunity } from "../../src/services/reco/communityRow";
import { cooccurrencePairs } from "../../src/services/reco/cooccurrence";
import { bestOfLibraryItems } from "../../src/services/reco/globalRows";
import { idfFor } from "../../src/services/reco/idfStore";
import { buildPageSnapshot } from "../../src/services/reco/pageBuilder";
import { applyServeExclusions, gateGlobalRow } from "../../src/services/reco/pageRows";
import type { SnapshotRow } from "../../src/services/reco/pageSnapshot";
import { computePool } from "../../src/services/reco/poolCompute";
import { resolveAnchorMeta } from "../../src/services/reco/profileBuilder";
import { computeTasteProfile } from "../../src/services/reco/profileCompute";
import type { ComputedProfile } from "../../src/services/reco/profileCompute";
import { serializeAnchors } from "../../src/services/reco/anchorStore";
import { pulseItemsFrom, rankPulse } from "../../src/services/reco/serverPulse";
import { trendingFromTmdb, trendingItemsFrom } from "../../src/services/reco/trendingRow";
import type { Candidate } from "../../src/services/reco/scoring/strategy";
import type { PoolPayload } from "../../src/services/reco/generationJob";
import type { ServeContext } from "../../src/services/reco/serveContext";
import { personaInputs, watchedKeys } from "../../src/services/reco/bench/benchPersona";
import type { BenchLibraryEntry, Persona } from "../../src/services/reco/bench/benchPersona";

/** Le jour du tirage des rangées tournantes : figé, pour qu'un passage en vaille un autre. */
export const BENCH_DAY = "2026-10-13";

interface RawItem {
  Id: string;
  Name?: string;
  Type?: string;
  ProviderIds?: Record<string, string>;
  Genres?: string[];
  Studios?: Array<{ Name?: string }>;
  ProductionYear?: number;
  RunTimeTicks?: number;
  CommunityRating?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  RecursiveItemCount?: number;
}

/** Relève la bibliothèque (films, séries) vue par un compte de TEST, sans ses données d'utilisateur. */
export async function captureLibrary(viewerId: string, file: string): Promise<number> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) throw new Error("Jellyfin non configuré");
  const out: BenchLibraryEntry[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < 40; page++) {
    const res = await fetch(
      `${url}/Items?userId=${viewerId}&Recursive=true&IncludeItemTypes=Movie,Series&EnableUserData=false` +
        `&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop` +
        `&Fields=ProviderIds,Genres,Studios,ProductionYear,RunTimeTicks,CommunityRating,BackdropImageTags,RecursiveItemCount` +
        `&StartIndex=${page * 1000}&Limit=1000`,
      { headers: jellyfinAuthHeaders(apiKey) }
    );
    if (!res.ok) throw new Error(`Jellyfin ${res.status}`);
    const data = (await res.json()) as { Items?: RawItem[] };
    const batch = data.Items ?? [];
    for (const item of batch) {
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
      if (!mediaType || !Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      const key = `${mediaType}:${tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        itemId: item.Id, name: item.Name ?? "", key, mediaType, tmdbId,
        hasPrimaryImage: !!item.ImageTags?.Primary, hasBackdrop: (item.BackdropImageTags?.length ?? 0) > 0,
        communityRating: item.CommunityRating ?? null, Genres: item.Genres, Studios: item.Studios,
        ProductionYear: item.ProductionYear, RunTimeTicks: item.RunTimeTicks, ProviderIds: item.ProviderIds,
        episodeCount: mediaType === "tv" ? item.RecursiveItemCount ?? 0 : 0,
      });
    }
    if (batch.length < 1000) break;
  }
  writeFileSync(file, JSON.stringify(out));
  return out.length;
}

export function loadLibrary(file: string): BenchLibraryEntry[] {
  return JSON.parse(readFileSync(file, "utf8")) as BenchLibraryEntry[];
}

/** Jellyseerr relaie TMDB : la même découverte (cf. vigieDiscover), demandée à TMDB sous ses noms, par la bande. */
async function tmdbAsSeerr(query: SeerrQuery): Promise<SeerrPage | null> {
  try {
    const res = await tmdbFetch<{ results?: Array<TmdbListResult & { origin_country?: string[] }> }>(
      `/discover/${query.mediaType}`, cappedReleaseParams(query.mediaType, { page: "1", ...tmdbDiscoverParams(query) }), { priority: "background" }
    );
    return {
      results: (res.results ?? []).map((r) => ({
        id: r.id, title: r.title, name: r.name, genreIds: r.genre_ids, voteAverage: r.vote_average, voteCount: r.vote_count,
        popularity: r.popularity, releaseDate: r.release_date, firstAirDate: r.first_air_date, originalLanguage: r.original_language,
        originCountry: r.origin_country, posterPath: r.poster_path, backdropPath: r.backdrop_path, adult: r.adult,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Ce que Vigie sert : la découverte réglée par le goût (le même chemin que le
 * serveur, Jellyseerr émulé par TMDB) et ce que Jellyseerr met en avant
 * (découverte par popularité, tendances — une page chacune, comme le serveur).
 */
async function vigieEmulation(profile: TasteVector): Promise<Candidate[]> {
  const out: Candidate[] = await candidatesFromVigieDiscover(profile, tmdbAsSeerr);
  const lists: Array<{ path: string; type: "movie" | "tv" | null }> = [
    { path: "/discover/movie", type: "movie" },
    { path: "/discover/tv", type: "tv" },
    { path: "/trending/all/week", type: null },
  ];
  for (const { path, type } of lists) {
    for (const page of ["1"]) {
      try {
        const res = await tmdbFetch<{ results?: Array<TmdbListResult & { media_type?: string }> }>(
          path, type ? { sort_by: "popularity.desc", page, ...titleLanguageParams() } : { page, ...titleLanguageParams() }, { priority: "background" }
        );
        for (const raw of res.results ?? []) {
          const t = type ?? (raw.media_type === "tv" ? "tv" : raw.media_type === "movie" ? "movie" : null);
          if (t && isReleasedResult(raw)) out.push(toCandidate(raw, t, "vigie"));
        }
      } catch {
        // Une liste muette n'empêche pas les autres.
      }
    }
  }
  return out;
}

export interface PersonaRun {
  profile: ComputedProfile;
  pool: PoolPayload;
  rows: SnapshotRow[];
  exclude: Set<string>;
  missing: string[];
}

/** Les comptes de la population : un persona « famille » compte pour plusieurs. */
function populationAccounts(population: readonly Persona[]): Array<{ id: string; watched: string[]; loved: string[] }> {
  const out: Array<{ id: string; watched: string[]; loved: string[] }> = [];
  for (const p of population) {
    const loved = p.history.filter((e) => e.signal === "loved").map((e) => e.key);
    for (let i = 0; i < Math.max(1, p.accounts ?? 1); i++) out.push({ id: `${p.id}#${i}`, watched: watchedKeys(p), loved });
  }
  return out;
}

async function globalRowsFor(
  persona: Persona,
  population: readonly Persona[],
  ctx: { exclude: Set<string>; includeVigie: boolean },
  run: { library: ReturnType<typeof personaInputs>["library"]; pool: PoolPayload }
): Promise<Map<string, SnapshotRow>> {
  // Les MÊMES portes que le serveur (gateGlobalRow) : rien de propre au banc.
  const gate = <T extends { key: string }>(key: string, items: T[]) => gateGlobalRow(key, items, run.pool);
  const rows = new Map<string, SnapshotRow>();
  const trending = await trendingFromTmdb().catch(() => []);
  rows.set("trending", {
    key: "trending",
    items: gate("trending", trendingItemsFrom({ computedAt: BENCH_DAY, origin: "tmdb", items: trending }, run.library, ctx)),
  });
  // Le pouls et la communauté : la population, ce persona compris (comme sur un vrai serveur).
  const accounts = populationAccounts(population);
  const watchers = new Map<string, Set<string>>();
  const likers = new Map<string, Set<string>>();
  for (const a of accounts) {
    for (const k of a.watched) watchers.set(k, (watchers.get(k) ?? new Set()).add(a.id));
    for (const k of a.loved) likers.set(k, (likers.get(k) ?? new Set()).add(a.id));
  }
  const pulse = rankPulse(watchers, likers, new Map());
  const metas = await getCachedMetaMany(pulse.map((p) => ({ mediaType: p.key.startsWith("tv:") ? "tv" : "movie", tmdbId: Number(p.key.split(":")[1]) })));
  rows.set("serverPulse", {
    key: "serverPulse",
    items: gate("serverPulse", pulseItemsFrom({ computedAt: BENCH_DAY, items: pulse }, run.library, metas, ctx)),
  });
  const pairs = cooccurrencePairs(accounts.map((a) => new Set(a.watched))).rows;
  const ranked = rankCommunity(pairs, communityAnchors(run.library, []), ctx.exclude);
  rows.set("community", { key: "community", items: gate("community", communityItems(ranked, { library: run.library, pool: run.pool, metaByKey: metas, inLibraryOnly: !ctx.includeVigie })) });
  rows.set("bestOfLibrary", { key: "bestOfLibrary", items: gate("bestOfLibrary", bestOfLibraryItems(run.library, ctx.exclude)) });
  void persona;
  return rows;
}

/** Le moteur entier pour UN persona : profil, pool, page servie (exclusions du moment comprises). */
export async function runPersona(persona: Persona, library: readonly BenchLibraryEntry[], population: readonly Persona[], now: number): Promise<PersonaRun> {
  const inputs = personaInputs(persona, library, now);
  const profile = await computeTasteProfile(
    { now, ratings: inputs.ratings, likes: inputs.likes, feedback: inputs.feedback, swipes: [], pendingWatchlist: [], signals: inputs.signals, measured: new Map() },
    { resolveMeta: resolveAnchorMeta, idfFor }
  );
  const profileRow = { facets: JSON.stringify(profile.vector), signalCount: profile.signalCount, animeShare: profile.animeShare, anchors: serializeAnchors(profile.stored) };
  const exclude = new Set([...inputs.accountKeys, ...libraryExclusionKeys(inputs.library.entries)]);
  const userId = `bench:${persona.id}`;
  const { payload: pool } = await computePool(
    { userId, quick: false, profileRow, includeVigie: true, library: inputs.library, likedPeople: [], exclusions: { everywhere: exclude } },
    { vigieSource: vigieEmulation }
  );
  const ctx: ServeContext = {
    state: "ready", signalCount: profile.signalCount, lambda: 0.7, includeVigie: true, community: true, trendingNow: true, exclude,
    profile: { facets: profile.vector, signalCount: profile.signalCount, animeShare: profile.animeShare },
    bootstrapping: false, tmdbConfigured: true, personalized: true, profileComputedAt: null, settingsUpdatedAt: null,
  };
  const globalRows = await globalRowsFor(persona, population, ctx, { library: inputs.library, pool });
  const snapshot = await buildPageSnapshot({
    userId, ctx, pool, poolStamp: null, library: inputs.library, vigieAvailable: true, globalRows, regional: [],
    providerRefOf: (id) => ({ id, name: "", logoPath: null }), builtAt: `${BENCH_DAY}T12:00:00.000Z`, dayKey: BENCH_DAY,
    globalsGeneratedAt: null,
  }, null);
  return { profile, pool, rows: applyServeExclusions(snapshot.rows, exclude), exclude, missing: inputs.missing };
}

/** Les fiches TMDB (cache) des titres d'une liste — pour les juger. */
export async function metasOf(keys: readonly string[]): Promise<Map<string, TitleMeta>> {
  return getCachedMetaMany(keys.map((k) => ({ mediaType: k.startsWith("tv:") ? "tv" : "movie", tmdbId: Number(k.split(":")[1]) })));
}
