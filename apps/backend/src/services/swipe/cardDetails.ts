import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import { tmdbConfigured, tmdbFetch } from "../tmdb/client";
import { mergeDetails } from "./detailsMerge";
import type { SwipeLang } from "./tmdbGenres";

/** Ce que le verso d'une carte affiche : titre localisé, synopsis, format. */
export interface CardDetails {
  title: string | null;
  overview: string | null;
  /** Durée d'un film, en minutes. */
  runtimeMinutes: number | null;
  /** Nombre de saisons d'une série. */
  seasons: number | null;
}

interface TmdbDetail {
  title?: string;
  name?: string;
  overview?: string;
  runtime?: number;
  number_of_seasons?: number;
}

const CACHE_MS = 24 * 3600_000;
const CACHE_MAX = 800;
const cache = new Map<string, { at: number; details: CardDetails }>();

const EMPTY: CardDetails = { title: null, overview: null, runtimeMinutes: null, seasons: null };

function remember(key: string, details: CardDetails): CardDetails {
  // Map ordonnée par insertion : la plus ancienne part en premier.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), details });
  return details;
}

async function fromJellyfin(userId: string, itemId: string): Promise<CardDetails | null> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;
  // `userId` : Jellyfin applique les droits du compte — un titre qu'il ne
  // voit pas ne rend rien, même à la clé admin.
  const q = `userId=${encodeURIComponent(userId)}&Ids=${encodeURIComponent(itemId)}&Fields=Overview,ChildCount`;
  const res = await fetch(`${url}/Items?${q}`, {
    headers: { "X-Emby-Token": apiKey },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    Items?: Array<{ Name?: string; Overview?: string; RunTimeTicks?: number; ChildCount?: number; Type?: string }>;
  };
  const item = data.Items?.[0];
  if (!item) return null;
  return {
    title: item.Name ?? null,
    overview: item.Overview ?? null,
    runtimeMinutes: item.Type === "Movie" && item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : null,
    seasons: item.Type === "Series" ? item.ChildCount ?? null : null,
  };
}

async function fromTmdb(mediaType: "movie" | "tv", tmdbId: number, lang: SwipeLang): Promise<CardDetails | null> {
  if (!tmdbConfigured()) return null;
  const raw = await tmdbFetch<TmdbDetail>(`/${mediaType}/${tmdbId}`, { language: lang === "fr" ? "fr-FR" : "en-US" });
  return {
    title: raw.title ?? raw.name ?? null,
    overview: raw.overview ?? null,
    runtimeMinutes: raw.runtime || null,
    seasons: raw.number_of_seasons ?? null,
  };
}

/**
 * Le verso d'une carte : TMDB dans la langue de l'utilisateur quand la clé
 * existe, Jellyfin (avec les droits du compte) en repli ou sans clé — cf.
 * mergeDetails. Toujours par le backend. Jamais d'exception : un verso vide
 * vaut mieux qu'une carte en erreur.
 */
export async function cardDetails(
  userId: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
  lang: SwipeLang,
  jellyfinItemId: string | null
): Promise<CardDetails> {
  const key = `${userId}|${mediaType}:${tmdbId}|${lang}|${jellyfinItemId ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.details;
  try {
    const remote = await fromTmdb(mediaType, tmdbId, lang).catch(() => null);
    // Jellyfin n'est lu que s'il peut apporter quelque chose : synopsis ou format manquants.
    const needLocal = !!jellyfinItemId && (!remote?.overview || (remote.runtimeMinutes == null && remote.seasons == null));
    const local = needLocal && jellyfinItemId ? await fromJellyfin(userId, jellyfinItemId).catch(() => null) : null;
    return remember(key, mergeDetails(remote, local, !!jellyfinItemId));
  } catch {
    return EMPTY;
  }
}
