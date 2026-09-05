/* ------------------------------------------------------------------ */
/*  Watch Providers — filtre bibliothèque via Jellyseerr discover      */
/*  Warm par plateforme à la demande (pas toutes au démarrage)         */
/*  Si Seer pas installé → retourne {} (fallback Studios côté client)  */
/*  GET /watch-providers : l'annuaire TMDB de la région (id, nom, logo)*/
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { getSeerrConfig } from "../services/seerConfig";
import { getWatchProviderDirectory } from "../services/tmdb/providerDirectory";
import { getSeasonEpisodes } from "../services/tmdb/seasonEpisodes";

// Cache par plateforme : "movies-8" → Set<tmdbId>
const discoverCache = new Map<string, Set<number>>();
const warmingPlatforms = new Set<number>();

/** Charge les TMDB IDs d'UNE plateforme (movies + tv) */
async function warmPlatform(seerr: { url: string; apiKey: string }, platformId: number): Promise<void> {
  if (warmingPlatforms.has(platformId)) return;
  warmingPlatforms.add(platformId);

  const start = Date.now();
  try {
    const [movies, tv] = await Promise.all([
      fetchDiscoverIds(seerr, platformId, "movies"),
      fetchDiscoverIds(seerr, platformId, "tv"),
    ]);
    discoverCache.set(`movies-${platformId}`, movies);
    discoverCache.set(`tv-${platformId}`, tv);
    console.log(`[TMDB] Platform ${platformId}: ${movies.size} movies + ${tv.size} TV (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.warn(`[TMDB] Failed platform ${platformId}:`, err);
  }
  warmingPlatforms.delete(platformId);
}

async function fetchDiscoverIds(
  seerr: { url: string; apiKey: string },
  platformId: number,
  mediaType: "movies" | "tv",
): Promise<Set<number>> {
  const ids = new Set<number>();
  const first = await fetch(
    `${seerr.url}/api/v1/discover/${mediaType}?watchProviders=${platformId}&watchRegion=FR&page=1`,
    { headers: { "X-Api-Key": seerr.apiKey }, signal: AbortSignal.timeout(15_000) },
  ).then((r) => (r.ok ? (r.json() as Promise<{ totalPages: number; results: Array<{ id: number }> }>) : null))
    .catch(() => null);

  if (!first) return ids;
  for (const r of first.results) ids.add(r.id);
  const totalPages = Math.min(first.totalPages, 500);

  for (let page = 2; page <= totalPages; page += 20) {
    const batch = Array.from({ length: Math.min(20, totalPages - page + 1) }, (_, i) => page + i);
    const results = await Promise.allSettled(
      batch.map((p) =>
        fetch(
          `${seerr.url}/api/v1/discover/${mediaType}?watchProviders=${platformId}&watchRegion=FR&page=${p}`,
          { headers: { "X-Api-Key": seerr.apiKey }, signal: AbortSignal.timeout(15_000) },
        ).then((r) => (r.ok ? r.json() : { results: [] })),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const item of (r.value as { results: Array<{ id: number }> }).results) {
          ids.add(item.id);
        }
      }
    }
  }
  return ids;
}

function isPlatformCached(platformId: number): boolean {
  return discoverCache.has(`movies-${platformId}`) && discoverCache.has(`tv-${platformId}`);
}

interface CheckPlatformBody {
  tmdbIds: Array<{ tmdbId: number; mediaType: "movie" | "tv" }>;
  platformId: number;
}

export async function tmdbRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/check-platform", async (request: FastifyRequest, _reply: FastifyReply) => {
    const body = request.body as CheckPlatformBody;
    if (!body.tmdbIds || !body.platformId) {
      return { matchingIds: [], cacheReady: false };
    }

    const seerr = getSeerrConfig();
    const cached = isPlatformCached(body.platformId);

    // Si pas en cache : warm cette plateforme spécifique (non-bloquant pour la première fois)
    if (!cached && seerr && !warmingPlatforms.has(body.platformId)) {
      // ATTENDRE le warm de cette plateforme seulement (pas toutes)
      await warmPlatform(seerr, body.platformId);
    }

    const movieIds = discoverCache.get(`movies-${body.platformId}`) ?? new Set<number>();
    const tvIds = discoverCache.get(`tv-${body.platformId}`) ?? new Set<number>();

    const matchingIds = body.tmdbIds
      .filter((item) => {
        const set = item.mediaType === "movie" ? movieIds : tvIds;
        return set.has(item.tmdbId);
      })
      .map((item) => item.tmdbId);

    return { matchingIds, cacheReady: isPlatformCached(body.platformId) };
  });

  /**
   * GET /api/tmdb/watch-providers
   *   → { region, providers: [{ id, name, logoPath }], logos: { [id]: logoPath } }
   * L'annuaire COMPLET des plateformes de la région configurée, dérivé de la
   * liste mondiale persistée, et la carte des logos (région + familles connues,
   * même hors région) — la source du menu Filtres. Sans clé TMDB : vide.
   */
  app.get("/watch-providers", async () => getWatchProviderDirectory());

  /**
   * GET /api/tmdb/tv/:tmdbId/season/:seasonNumber/episodes
   * → { tmdbId, seasonNumber, episodes: [{ episodeNumber, voteAverage, voteCount }] }
   * Les notes TMDB des épisodes d'une saison (mémoire + disque, un jour de
   * fraîcheur, copie périmée servie si TMDB ne répond pas). Sans clé TMDB ou
   * saison inconnue : liste vide, jamais d'erreur.
   */
  app.get("/tv/:tmdbId/season/:seasonNumber/episodes", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { tmdbId?: string; seasonNumber?: string };
    const tmdbId = Number(params.tmdbId);
    const seasonNumber = Number(params.seasonNumber);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
      return reply.status(400).send({ message: "tmdbId and seasonNumber must be integers" });
    }
    const season = await getSeasonEpisodes(tmdbId, seasonNumber);
    return season ?? { tmdbId, seasonNumber, episodes: [] };
  });

  /**
   * GET /api/tmdb/resolve?tmdbId=123&mediaType=movie
   * → { jellyfinId: "xxx", remoteTrailers: [{ Url, Name }] }
   * remoteTrailers : RemoteTrailers Jellyfin de l'item résolu (consommé par le
   * plugin Seer pour fusionner avec les vidéos TMDB, comme MediaDetail).
   */
  app.get("/resolve", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { tmdbId, mediaType } = request.query as { tmdbId?: string; mediaType?: string };
    if (!tmdbId || !mediaType) return { jellyfinId: null, remoteTrailers: [] };

    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();
    if (!jellyfinUrl || !apiKey) return { jellyfinId: null, remoteTrailers: [] };

    type ResolvedItem = {
      Id: string; Name?: string; Type?: string;
      ProviderIds?: Record<string, string>; ImageTags?: Record<string, string>;
      RemoteTrailers?: Array<{ Url?: string; Name?: string }>;
    };
    const toResult = (match: ResolvedItem) => ({
      jellyfinId: match.Id,
      remoteTrailers: (match.RemoteTrailers ?? []).filter((t) => t.Url),
    });

    const itemTypes = mediaType === "movie" ? "Movie" : "Series";
    try {
      const fields = "ProviderIds,ImageTags,BackdropImageTags,RemoteTrailers";

      // Stratégie 1 : AnyProviderIdEquals + filtre exact côté serveur
      const res = await fetch(
        `${jellyfinUrl}/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=${itemTypes}&Recursive=true&Limit=100&Fields=${fields}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(8_000) },
      );
      if (res.ok) {
        const data = (await res.json()) as { Items?: ResolvedItem[] };
        const match = data.Items?.find((item) => item.ProviderIds?.Tmdb === String(tmdbId));
        if (match) {
          console.log(`[TMDB] Resolved ${mediaType} tmdb:${tmdbId} → ${match.Id} "${match.Name}" (Type=${match.Type}, hasImages=${!!match.ImageTags?.Primary})`);
          return toResult(match);
        }
      }

      // Stratégie 2 : Fallback — scan complet
      const allRes = await fetch(
        `${jellyfinUrl}/Items?IncludeItemTypes=${itemTypes}&Recursive=true&Limit=10000&Fields=${fields}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(15_000) },
      );
      if (allRes.ok) {
        const allData = (await allRes.json()) as { Items?: ResolvedItem[] };
        const match = allData.Items?.find((item) => item.ProviderIds?.Tmdb === String(tmdbId));
        if (match) {
          console.log(`[TMDB] Resolved (fallback) ${mediaType} tmdb:${tmdbId} → ${match.Id} "${match.Name}" (Type=${match.Type}, hasImages=${!!match.ImageTags?.Primary})`);
          return toResult(match);
        }
      }

      return { jellyfinId: null, remoteTrailers: [] };
    } catch {
      return { jellyfinId: null, remoteTrailers: [] };
    }
  });

  /**
   * GET /api/tmdb/trailers?tmdbId=123&mediaType=movie|tv
   * → { videos: [{ key, name, type, site, lang?, url }] }
   *
   * Source : Jellyseerr (plugin seer) qui proxifie TMDB. Renvoie la liste
   * COMPLÈTE des vidéos liées (trailers + teasers, toutes saisons agrégées au
   * niveau show), plus riche que les RemoteTrailers importés par Jellyfin.
   * Dégradation propre : Seerr absent / erreur → { videos: [] } (le client
   * retombe sur les RemoteTrailers Jellyfin).
   */
  app.get("/trailers", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { tmdbId, mediaType } = request.query as { tmdbId?: string; mediaType?: string };
    if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) return { videos: [] };

    const seerr = getSeerrConfig();
    if (!seerr) return { videos: [] };

    try {
      const res = await fetch(`${seerr.url}/api/v1/${mediaType}/${tmdbId}`, {
        headers: { "X-Api-Key": seerr.apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return { videos: [] };
      const data = (await res.json()) as {
        relatedVideos?: Array<{
          url?: string;
          key?: string;
          name?: string;
          type?: string;
          site?: string;
          iso_639_1?: string;
        }>;
      };
      const videos = (data.relatedVideos ?? [])
        .filter((v) => (v.site ?? "YouTube").toLowerCase() === "youtube" && (v.key || v.url))
        .map((v) => ({
          key: v.key ?? "",
          name: v.name,
          type: v.type,
          site: v.site ?? "YouTube",
          lang: v.iso_639_1,
          url: v.url || (v.key ? `https://www.youtube.com/watch?v=${v.key}` : ""),
        }))
        .filter((v) => v.url);
      return { videos };
    } catch {
      return { videos: [] };
    }
  });
}
