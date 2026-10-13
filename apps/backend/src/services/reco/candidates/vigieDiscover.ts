import { getSeerrConfig } from "../../seerConfig";
import type { SeerrConfig } from "../../seerConfig";
import type { Candidate, TasteVector } from "../scoring/strategy";
import { seerrCandidates } from "./vigieSource";
import type { SeerrPage } from "./vigieSource";

/**
 * La DÉCOUVERTE de Jellyseerr, réglée par le goût du compte : ses genres, ses
 * mots-clés, sa langue d'origine (l'animé), ses chaînes et studios, son époque,
 * des votes et une note minimaux. Jellyseerr relaie TMDB et y applique SES
 * filtres — le cœur ne lit jamais les tables de l'extension. Appels bornés
 * (DISCOVER_QUERIES_MAX), mis en cache : deux comptes aux goûts voisins
 * partagent les mêmes réponses.
 */
export interface SeerrQuery {
  mediaType: "movie" | "tv";
  /** Les paramètres de `/api/v1/discover/{movies,tv}`, dans les noms de Jellyseerr. */
  params: Record<string, string>;
}

/** Requêtes au plus par génération (la mise en avant de Jellyseerr en ajoute trois). */
export const DISCOVER_QUERIES_MAX = 16;
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 6 * 3600_000;
const CACHE_MAX = 300;
/** Une langue d'origine autre que l'anglais compte dès ce poids relatif (l'animé, le cinéma coréen). */
const LANG_MIN_SHARE = 0.2;
/** Fenêtre de l'animé : les saisons récentes, là où Jellyseerr suit l'actualité. */
const ANIME_RECENT_YEARS = 8;

const MOVIE_GENRES = new Set([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]);
const TV_GENRES = new Set([10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10765, 10768, 37]);

/** Pur : les identifiants des facettes d'un préfixe qui pèsent le plus dans le goût. */
function topIds(facets: Readonly<Record<string, number>>, prefix: string, n: number): string[] {
  return Object.entries(facets)
    .filter(([key, weight]) => key.startsWith(prefix) && weight > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([key]) => key.slice(prefix.length));
}

/** Pur : les découvertes à demander pour ce goût, dans l'ordre de ce qu'elles apportent. */
export function vigieDiscoverQueries(profile: TasteVector, now: Date = new Date()): SeerrQuery[] {
  const facets = profile.facets;
  const year = now.getUTCFullYear();
  const out: SeerrQuery[] = [];
  const quality = { voteAverageGte: "6.8" };
  const decades = topIds(facets, "decade:", 3).map(Number).filter(Number.isFinite);
  const from = decades.length ? Math.min(...decades) : year - 30;
  const since = (t: "movie" | "tv", y: number): Record<string, string> =>
    (t === "movie" ? { primaryReleaseDateGte: `${y}-01-01` } : { firstAirDateGte: `${y}-01-01` });

  // 1. Ses mots-clés (deux grappes, « ou ») : la parenté la plus fine que Jellyseerr sache filtrer.
  const keywords = topIds(facets, "kw:", 6);
  for (const group of [keywords.slice(0, 3), keywords.slice(3, 6)]) {
    if (!group.length) continue;
    for (const t of ["movie", "tv"] as const) {
      out.push({ mediaType: t, params: { keywords: group.join("|"), sortBy: "popularity.desc", voteCountGte: "100", ...quality } });
    }
  }
  // 2. L'animé (ou une autre langue d'origine qui compte) : récent, populaire, en deux pages pour les séries.
  const langs = Object.entries(facets).filter(([k, w]) => k.startsWith("lang:") && w > 0).sort((a, b) => b[1] - a[1]);
  const top = langs[0]?.[1] ?? 0;
  const other = langs.find(([k, w]) => k !== "lang:en" && w >= LANG_MIN_SHARE * top)?.[0].slice("lang:".length);
  if (other) {
    const anime: Record<string, string> = other === "ja" ? { genre: "16" } : {};
    for (const page of ["1", "2"]) {
      out.push({ mediaType: "tv", params: { language: other, ...anime, sortBy: "popularity.desc", voteCountGte: "50", ...quality, ...since("tv", year - ANIME_RECENT_YEARS), page } });
    }
    out.push({ mediaType: "movie", params: { language: other, ...anime, sortBy: "popularity.desc", voteCountGte: "100", ...quality, ...since("movie", year - ANIME_RECENT_YEARS) } });
  }
  // 3. Ses genres, par monde (les identifiants diffèrent entre films et séries), dans son époque, les mieux notés.
  const genres = topIds(facets, "genre:", 10).map(Number);
  for (const t of ["movie", "tv"] as const) {
    const ids = genres.filter((g) => (t === "movie" ? MOVIE_GENRES : TV_GENRES).has(g)).slice(0, 2);
    if (ids.length) out.push({ mediaType: t, params: { genre: ids.join("|"), sortBy: "vote_average.desc", voteCountGte: t === "movie" ? "500" : "200", ...since(t, from) } });
  }
  // 4. Ses chaînes (séries) et ses studios (films).
  for (const network of topIds(facets, "network:", 2)) {
    out.push({ mediaType: "tv", params: { network, sortBy: "popularity.desc", voteCountGte: "100", ...quality } });
  }
  for (const studio of topIds(facets, "studio:", 2)) {
    out.push({ mediaType: "movie", params: { studio, sortBy: "popularity.desc", voteCountGte: "200", ...quality } });
  }
  return out.slice(0, DISCOVER_QUERIES_MAX);
}

/** Les noms de TMDB pour les mêmes filtres (Jellyseerr les relaie tels quels) : l'émulation du banc. */
export function tmdbDiscoverParams(query: SeerrQuery): Record<string, string> {
  const names: Record<string, string> = {
    genre: "with_genres", keywords: "with_keywords", language: "with_original_language", studio: "with_companies",
    network: "with_networks", voteCountGte: "vote_count.gte", voteAverageGte: "vote_average.gte",
    primaryReleaseDateGte: "primary_release_date.gte", firstAirDateGte: "first_air_date.gte", sortBy: "sort_by", page: "page",
  };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query.params)) out[names[key] ?? key] = value;
  return out;
}

type Fetcher = (query: SeerrQuery) => Promise<SeerrPage | null>;
const cache = new Map<string, { at: number; page: SeerrPage }>();

function queryUrl(seerr: SeerrConfig, query: SeerrQuery): string {
  const params = new URLSearchParams({ page: "1", ...query.params });
  return `${seerr.url}/api/v1/discover/${query.mediaType === "movie" ? "movies" : "tv"}?${params.toString()}`;
}

/** La réponse de Jellyseerr, en cache six heures ; un échec rend null (la génération continue). */
async function seerrFetch(seerr: SeerrConfig, query: SeerrQuery): Promise<SeerrPage | null> {
  const url = queryUrl(seerr, query);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.page;
  try {
    const res = await fetch(url, { headers: { "X-Api-Key": seerr.apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const page = (await res.json()) as SeerrPage;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(url, { at: Date.now(), page });
    return page;
  } catch {
    return null;
  }
}

/** Les candidats de la découverte réglée par le goût ; Vigie absente : rien, sans erreur. */
export async function candidatesFromVigieDiscover(profile: TasteVector, fetcher?: Fetcher): Promise<Candidate[]> {
  let fetchPage = fetcher;
  if (!fetchPage) {
    const seerr = getSeerrConfig();
    if (!seerr) return [];
    fetchPage = (query) => seerrFetch(seerr, query);
  }
  const out: Candidate[] = [];
  for (const query of vigieDiscoverQueries(profile)) {
    const page = await fetchPage(query);
    if (page) out.push(...seerrCandidates(page, query.mediaType));
  }
  return out;
}
