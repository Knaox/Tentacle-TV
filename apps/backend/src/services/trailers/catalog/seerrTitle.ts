/* ------------------------------------------------------------------ */
/*  Jellyseerr à défaut de TMDB : le titre ET ses vidéos, en un appel   */
/*                                                                     */
/*  Sans clé TMDB sur ce serveur (ou TMDB muet), l'extension Vigie     */
/*  relie souvent un Jellyseerr, qui relaie TMDB : `/api/v1/{type}/{id}`*/
/*  rend le nom dans SA langue (« Rick et Morty »), l'original, les     */
/*  dates, les saisons et les vidéos liées. De quoi chercher AlloCiné  */
/*  hors bibliothèque (une carte de Vigie) sans clé TMDB. Gardé un jour */
/*  en mémoire partagée.                                               */
/* ------------------------------------------------------------------ */

import { getSeerrConfig } from "../../seerConfig";
import type { TmdbVideo } from "../../../trailers/trailerList";
import { days, remembered } from "./catalogMemory";
import type { CatalogMediaType, TmdbTitle } from "./tmdbCatalog";

const SEERR_TIMEOUT_MS = 8_000;

interface SeerrTitleDto {
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  originalLanguage?: string;
  releaseDate?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  inProduction?: boolean;
  seasons?: Array<{ seasonNumber?: number; airDate?: string | null }>;
  relatedVideos?: Array<{ url?: string; key?: string; name?: string; type?: string; site?: string; iso_639_1?: string }>;
}

const youtubeUrl = (key: string) => `https://www.youtube.com/watch?v=${key}`;

/** Pur : le titre tel que le catalogue le garde, d'après la réponse de Jellyseerr. */
export function seerrTitleOf(kind: CatalogMediaType, dto: SeerrTitleDto): TmdbTitle {
  const names = [dto.title ?? dto.name, dto.originalTitle ?? dto.originalName]
    .filter((name): name is string => typeof name === "string" && name.trim() !== "")
    .map((name) => name.trim());
  const videos: TmdbVideo[] = (dto.relatedVideos ?? [])
    .filter((v) => (v.site ?? "YouTube").toLowerCase() === "youtube" && (v.key || v.url))
    .map((v) => ({ key: v.key ?? "", name: v.name, type: v.type, site: "YouTube", lang: v.iso_639_1, url: v.url || youtubeUrl(v.key ?? "") }));
  return {
    kind,
    names: [...new Set(names)],
    originalLanguage: dto.originalLanguage ? dto.originalLanguage.toLowerCase() : null,
    releaseDate: (kind === "movie" ? dto.releaseDate : dto.firstAirDate) || null,
    lastAirDate: kind === "tv" ? dto.lastAirDate || null : null,
    ongoing: kind === "tv" && dto.inProduction === true,
    seasons: (dto.seasons ?? [])
      .filter((s): s is { seasonNumber: number; airDate?: string | null } => Number.isInteger(s.seasonNumber))
      .map((s) => ({ season: s.seasonNumber, airDate: s.airDate || null })),
    videos,
  };
}

async function readSeerrTitle(tmdbId: number, kind: CatalogMediaType): Promise<TmdbTitle | null> {
  const seerr = getSeerrConfig();
  if (!seerr) return null;
  try {
    const res = await fetch(`${seerr.url}/api/v1/${kind}/${tmdbId}`, {
      headers: { "X-Api-Key": seerr.apiKey },
      signal: AbortSignal.timeout(SEERR_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return seerrTitleOf(kind, (await res.json()) as SeerrTitleDto);
  } catch {
    return null;
  }
}

/** Le titre selon Jellyseerr (mémoire partagée, un jour) ; `null` : pas de Jellyseerr, ou muet. */
export function fetchSeerrTitle(tmdbId: number, kind: CatalogMediaType): Promise<TmdbTitle | null> {
  if (!getSeerrConfig()) return Promise.resolve(null);
  return remembered(`trailers:seerr-title:${kind}:${tmdbId}`, () => readSeerrTitle(tmdbId, kind), () => days(1));
}
