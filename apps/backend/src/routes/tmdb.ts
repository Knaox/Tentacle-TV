/* ------------------------------------------------------------------ */
/*  Watch Providers — via Jellyseerr discover                          */
/*  Warm par plateforme à la demande (pas toutes au démarrage)         */
/*  Si Seer pas installé → retourne {} (fallback Studios côté client)  */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { requireAuth } from "../middleware/auth";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";

// Cache par plateforme : "movies-8" → Set<tmdbId>
const discoverCache = new Map<string, Set<number>>();
const warmingPlatforms = new Set<number>();

const INSTALLED_PATH = resolve(__dirname, "../../data/plugins/installed.json");

function getSeerrConfig(): { url: string; apiKey: string } | null {
  try {
    if (!existsSync(INSTALLED_PATH)) return null;
    const installed = JSON.parse(readFileSync(INSTALLED_PATH, "utf-8"));
    const seer = installed.find((p: { pluginId?: string }) => p.pluginId === "seer");
    const url = seer?.config?.url as string;
    const apiKey = seer?.config?.apiKey as string;
    if (!url || !apiKey) return null;
    return { url: url.replace(/\/$/, ""), apiKey };
  } catch {
    return null;
  }
}

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

  /** GET /api/tmdb/resolve?tmdbId=123&mediaType=movie → { jellyfinId: "xxx" } */
  app.get("/resolve", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { tmdbId, mediaType } = request.query as { tmdbId?: string; mediaType?: string };
    if (!tmdbId || !mediaType) return { jellyfinId: null };

    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();
    if (!jellyfinUrl || !apiKey) return { jellyfinId: null };

    const itemTypes = mediaType === "movie" ? "Movie" : "Series";
    try {
      const fields = "ProviderIds,ImageTags,BackdropImageTags";

      // Stratégie 1 : AnyProviderIdEquals + filtre exact côté serveur
      const res = await fetch(
        `${jellyfinUrl}/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=${itemTypes}&Recursive=true&Limit=100&Fields=${fields}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(8_000) },
      );
      if (res.ok) {
        const data = (await res.json()) as { Items?: Array<{ Id: string; Name?: string; Type?: string; ProviderIds?: Record<string, string>; ImageTags?: Record<string, string> }> };
        const match = data.Items?.find((item) => item.ProviderIds?.Tmdb === String(tmdbId));
        if (match) {
          console.log(`[TMDB] Resolved ${mediaType} tmdb:${tmdbId} → ${match.Id} "${match.Name}" (Type=${match.Type}, hasImages=${!!match.ImageTags?.Primary})`);
          return { jellyfinId: match.Id };
        }
      }

      // Stratégie 2 : Fallback — scan complet
      const allRes = await fetch(
        `${jellyfinUrl}/Items?IncludeItemTypes=${itemTypes}&Recursive=true&Limit=10000&Fields=${fields}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(15_000) },
      );
      if (allRes.ok) {
        const allData = (await allRes.json()) as { Items?: Array<{ Id: string; Name?: string; Type?: string; ProviderIds?: Record<string, string>; ImageTags?: Record<string, string> }> };
        const match = allData.Items?.find((item) => item.ProviderIds?.Tmdb === String(tmdbId));
        if (match) {
          console.log(`[TMDB] Resolved (fallback) ${mediaType} tmdb:${tmdbId} → ${match.Id} "${match.Name}" (Type=${match.Type}, hasImages=${!!match.ImageTags?.Primary})`);
          return { jellyfinId: match.Id };
        }
      }

      return { jellyfinId: null };
    } catch {
      return { jellyfinId: null };
    }
  });
}
