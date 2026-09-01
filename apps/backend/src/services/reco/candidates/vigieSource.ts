import { getSeerrConfig } from "../../seerConfig";
import { decadeOf } from "../facets";
import type { FacetEntry } from "../facets";
import type { Candidate } from "../scoring/strategy";

// Jellyseerr répond en camelCase (contrairement à TMDB nu).
interface SeerrResult {
  id: number;
  mediaType?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  genreIds?: number[];
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  releaseDate?: string;
  firstAirDate?: string;
  originalLanguage?: string;
  posterPath?: string | null;
}

interface SeerrPage {
  results?: SeerrResult[];
}

function coarseFacets(raw: SeerrResult): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of raw.genreIds ?? []) out.push({ key: `genre:${g}`, mult: 1 });
  const date = raw.releaseDate || raw.firstAirDate || "";
  if (/^\d{4}/.test(date)) out.push({ key: `decade:${decadeOf(Number(date.slice(0, 4)))}`, mult: 1 });
  if (raw.originalLanguage) out.push({ key: `lang:${raw.originalLanguage}`, mult: 1 });
  return out;
}

function toCandidate(raw: SeerrResult, mediaType: "movie" | "tv"): Candidate {
  const date = raw.releaseDate || raw.firstAirDate || "";
  return {
    key: `${mediaType}:${raw.id}`,
    mediaType,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? "",
    year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    facets: coarseFacets(raw),
    voteAverage: raw.voteAverage ?? null,
    voteCount: raw.voteCount ?? null,
    popularity: raw.popularity ?? null,
    source: "vigie",
    posterPath: raw.posterPath ?? null,
  };
}

const PAGES = 2;
const TIMEOUT_MS = 15_000;

/**
 * Catalogue Vigie (Jellyseerr) : des titres demandables à la volée, donc la
 * matière de la rangée « À découvrir ». Plugin absent ou muet → liste vide,
 * la page dégrade sur la seule bibliothèque (aucune erreur).
 */
export async function candidatesFromVigie(): Promise<Candidate[]> {
  const seerr = getSeerrConfig();
  if (!seerr) return [];

  const out: Candidate[] = [];
  const endpoints: Array<{ path: string; mediaType: "movie" | "tv" | null }> = [
    { path: "discover/movies", mediaType: "movie" },
    { path: "discover/tv", mediaType: "tv" },
    // trending mélange les types : chaque résultat porte son mediaType.
    { path: "discover/trending", mediaType: null },
  ];

  for (const { path, mediaType } of endpoints) {
    for (let page = 1; page <= PAGES; page++) {
      try {
        const res = await fetch(`${seerr.url}/api/v1/${path}?page=${page}`, {
          headers: { "X-Api-Key": seerr.apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) break;
        const data = (await res.json()) as SeerrPage;
        for (const raw of data.results ?? []) {
          const t = mediaType ?? (raw.mediaType === "tv" ? "tv" : raw.mediaType === "movie" ? "movie" : null);
          if (!t) continue;
          out.push(toCandidate(raw, t));
        }
      } catch {
        break;
      }
    }
  }
  return out;
}
