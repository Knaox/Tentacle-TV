import { EXPLICIT_FACET, UNIVERSE_FACET, isKidsAnimationCoarse } from "../universes";
import { getSeerrConfig } from "../../seerConfig";
import { ANIME_UNIVERSE_KEY, decadeOf, isAnimeCoarse } from "../facets";
import type { FacetEntry } from "../facets";
import type { Candidate } from "../scoring/strategy";
import { isReleasedResult } from "./released";

// Jellyseerr répond en camelCase (contrairement à TMDB nu).
interface SeerrResult {
  id: number;
  adult?: boolean;
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
  originCountry?: string[];
  posterPath?: string | null;
  backdropPath?: string | null;
}

export interface SeerrPage {
  results?: SeerrResult[];
}

function coarseFacets(raw: SeerrResult): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of raw.genreIds ?? []) out.push({ key: `genre:${g}`, mult: 1 });
  const date = raw.releaseDate || raw.firstAirDate || "";
  if (/^\d{4}/.test(date)) out.push({ key: `decade:${decadeOf(Number(date.slice(0, 4)))}`, mult: 1 });
  if (raw.originalLanguage) out.push({ key: `lang:${raw.originalLanguage}`, mult: 1 });
  if (isAnimeCoarse(raw.genreIds ?? [], raw.originalLanguage, raw.originCountry)) {
    out.push({ key: ANIME_UNIVERSE_KEY, mult: 1 });
  }
  if (isKidsAnimationCoarse(raw.genreIds ?? [])) out.push({ key: UNIVERSE_FACET.kidsAnimation, mult: 1 });
  if (raw.adult === true) out.push({ key: EXPLICIT_FACET, mult: 0 });
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
    // Jellyseerr répond dans la langue de son interface : le titre est localisé.
    titleLocalized: true,
    posterPath: raw.posterPath ?? null,
    backdropPath: raw.backdropPath ?? null,
  };
}

/** Une page par liste mise en avant : la découverte réglée par le goût fait le reste (cf. vigieDiscover). */
const PAGES = 1;
const TIMEOUT_MS = 15_000;

/** Pur : les titres SORTIS d'une page de Jellyseerr, en candidats Vigie (le type vient de l'appel, ou de chaque résultat). */
export function seerrCandidates(page: SeerrPage, mediaType: "movie" | "tv" | null): Candidate[] {
  const out: Candidate[] = [];
  for (const raw of page.results ?? []) {
    const t = mediaType ?? (raw.mediaType === "tv" ? "tv" : raw.mediaType === "movie" ? "movie" : null);
    if (t && isReleasedResult(raw)) out.push(toCandidate(raw, t));
  }
  return out;
}

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
        out.push(...seerrCandidates((await res.json()) as SeerrPage, mediaType));
      } catch {
        break;
      }
    }
  }
  return out;
}
