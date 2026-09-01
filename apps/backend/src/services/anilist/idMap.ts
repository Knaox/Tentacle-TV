import { getPrisma } from "../db";
import { getCachedMeta } from "../tmdb/metaCache";
import { searchAnime } from "./client";

/**
 * Correspondance d'identifiants tmdb → anilist. Un titre Jellyfin porte un
 * tmdbId ou un tvdbId, jamais un anilistId : la table communautaire
 * Fribb/anime-lists (mapping anidb/anilist/tvdb/tmdb/mal maintenu) fait
 * l'essentiel, la recherche AniList (titre romaji + année) sert de repli.
 * Toute résolution — y compris l'échec (`source: "none"`) — est cachée en
 * base : on ne re-résout jamais le même titre.
 *
 * Effet de bord assumé et UTILE : la présence d'un titre dans Fribb vaut
 * détection « c'est un animé » — plus fiable que toute heuristique de genres.
 */

const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const FRIBB_TTL_MS = 7 * 24 * 3600_000;

interface FribbEntry {
  anilist_id?: number;
  themoviedb_id?: number;
  thetvdb_id?: number;
  type?: string; // "TV" | "MOVIE" | "OVA" | …
}

// Le fichier fait plusieurs mégaoctets : chargé au premier besoin, gardé en
// deux index mémoire, rafraîchi au plus une fois par semaine.
let byTmdbMovie = new Map<number, number>();
let byTvdb = new Map<number, number>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function ensureFribbLoaded(): Promise<void> {
  if (Date.now() - loadedAt < FRIBB_TTL_MS) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(FRIBB_URL, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return;
      const entries = (await res.json()) as FribbEntry[];
      const movies = new Map<number, number>();
      const tvdb = new Map<number, number>();
      for (const e of entries) {
        if (!e.anilist_id) continue;
        // Côté films, themoviedb_id est fiable ; côté séries, la colonne
        // pivot de Fribb est thetvdb_id.
        if (e.themoviedb_id && e.type === "MOVIE" && !movies.has(e.themoviedb_id)) {
          movies.set(e.themoviedb_id, e.anilist_id);
        }
        if (e.thetvdb_id && e.type !== "MOVIE" && !tvdb.has(e.thetvdb_id)) {
          tvdb.set(e.thetvdb_id, e.anilist_id);
        }
      }
      byTmdbMovie = movies;
      byTvdb = tvdb;
      loadedAt = Date.now();
      console.log(`[AniList] Mapping Fribb chargé : ${movies.size} films, ${tvdb.size} séries`);
    } catch (err) {
      console.warn("[AniList] Mapping Fribb indisponible :", err);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export interface AnilistResolution {
  anilistId: number | null;
  source: "fribb" | "search" | "none";
}

/**
 * Résout (mediaType, tmdbId[, tvdbId]) → anilistId. Cache d'abord, puis
 * Fribb, puis recherche par titre. Rend aussi la source — "none" signifie
 * « résolu comme introuvable », à ne pas retenter.
 */
export async function resolveAnilistId(
  mediaType: "movie" | "tv",
  tmdbId: number,
  tvdbId: number | null
): Promise<AnilistResolution> {
  const prisma = getPrisma();
  const cached = await prisma.animeIdMap.findUnique({
    where: { mediaType_tmdbId: { mediaType, tmdbId } },
  });
  if (cached) {
    return { anilistId: cached.anilistId, source: cached.source as AnilistResolution["source"] };
  }

  await ensureFribbLoaded();
  let anilistId: number | null = null;
  let source: AnilistResolution["source"] = "none";

  if (mediaType === "movie") {
    anilistId = byTmdbMovie.get(tmdbId) ?? null;
  } else if (tvdbId != null) {
    anilistId = byTvdb.get(tvdbId) ?? null;
  }
  if (anilistId != null) source = "fribb";

  if (anilistId == null) {
    // Repli : recherche AniList par titre (le cache TMDB fournit titre + année
    // sans appel réseau supplémentaire quand il est chaud).
    const meta = await getCachedMeta(mediaType, tmdbId);
    if (meta?.title) {
      anilistId = await searchAnime(meta.title, meta.year, mediaType === "movie" ? "MOVIE" : "TV");
      if (anilistId != null) source = "search";
    }
  }

  await prisma.animeIdMap.upsert({
    where: { mediaType_tmdbId: { mediaType, tmdbId } },
    create: { mediaType, tmdbId, anilistId, tvdbId, source },
    update: { anilistId, tvdbId, source, resolvedAt: new Date() },
  });
  return { anilistId, source };
}
