/* ------------------------------------------------------------------ */
/*  TMDB pour le catalogue : le titre, ses saisons, et leurs vidéos     */
/*                                                                     */
/*  Jellyfin ne pose aucune bande-annonce sur une saison, et TMDB      */
/*  n'en a souvent qu'au niveau de la SAISON (Rick et Morty : « Season */
/*  1 Promos » pour la série, les autres sous `/tv/{id}/season/{n}`).  */
/*  Deux lectures, gardées en mémoire partagée (`catalogMemory.ts`) :  */
/*  - le TITRE (`trailers:tmdb:<type>:<id>:<langue>`) : ses noms dans  */
/*    la langue du serveur, original et alternatifs (ceux que cherche  */
/*    AlloCiné), ses dates, la liste de ses saisons, et ses vidéos —   */
/*    la langue du serveur, l'anglais, sans langue, puis la langue     */
/*    originale s'il n'y a rien là (`titleVideos.ts` fait de même pour */
/*    l'aperçu) ;                                                      */
/*  - une SAISON (`trailers:tmdb:tv:<id>:s<n>:<langue>`) : ses vidéos. */
/*  7 jours chacune, 1 jour quand elle n'a aucune vidéo. Par le client */
/*  cadencé de TMDB, file interactive quand quelqu'un attend.          */
/* ------------------------------------------------------------------ */

import { TmdbError, tmdbFetch } from "../../tmdb/client";
import { orderTmdbVideos, type TmdbVideoDto } from "../titleVideos";
import type { TmdbVideo } from "../../../trailers/trailerList";
import { days, remembered, type CatalogPriority } from "./catalogMemory";

export type CatalogMediaType = "movie" | "tv";

export interface TmdbSeasonInfo {
  season: number;
  airDate: string | null;
}

export interface TmdbTitle {
  kind: CatalogMediaType;
  /** Le nom dans la langue du serveur, l'original, et les titres alternatifs de ses pays — sans doublon. */
  names: string[];
  originalLanguage: string | null;
  /** La sortie du film, ou la première diffusion de la série. */
  releaseDate: string | null;
  lastAirDate: string | null;
  /** Une série encore produite : de nouvelles saisons arrivent. */
  ongoing: boolean;
  /** Les pays d'origine (codes ISO, `US`) : la garde des homonymes (`namesAnotherVariant`). */
  countries: string[];
  seasons: TmdbSeasonInfo[];
  videos: TmdbVideo[];
}

interface TitleDto {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language?: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  in_production?: boolean;
  status?: string;
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1?: string }>;
  seasons?: Array<{ season_number?: number; air_date?: string | null }>;
  videos?: { results?: TmdbVideoDto[] };
  alternative_titles?: { titles?: AltTitle[]; results?: AltTitle[] };
}

interface AltTitle {
  iso_3166_1?: string;
  title?: string;
}

const TMDB_TIMEOUT_MS = 8_000;
/** En fond (la préparation des aperçus), l'appel attend son tour derrière les autres : plus de patience. */
const TMDB_BACKGROUND_TIMEOUT_MS = 30_000;
/** Les pays dont les titres alternatifs comptent, par langue du serveur (AlloCiné cherche le nom français). */
const ALT_COUNTRIES: Record<string, readonly string[]> = { fr: ["FR", "BE", "CH", "CA"] };

function withTimeout<T>(promise: Promise<T>, priority: CatalogPriority): Promise<T> {
  const timeoutMs = priority === "background" ? TMDB_BACKGROUND_TIMEOUT_MS : TMDB_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`délai de ${timeoutMs} ms dépassé`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const primary = (lang: string | null | undefined) => (lang ?? "").slice(0, 2).toLowerCase();

/** Les langues des vidéos à demander : celle du serveur, l'anglais, et les vidéos sans langue. */
export function videoLanguages(lang: string | null | undefined): string {
  return [...new Set([primary(lang), "en"].filter(Boolean)), "null"].join(",");
}

const isTrailerType = (video: TmdbVideo) => /^(trailer|teaser)$/i.test(video.type ?? "");
const ttlOf = (videos: readonly TmdbVideo[]) => days(videos.length > 0 ? 7 : 1);

/** Pur : le titre tel que le catalogue le garde, d'après la réponse de TMDB. */
export function tmdbTitleOf(kind: CatalogMediaType, dto: TitleDto, lang: string | null | undefined): Omit<TmdbTitle, "videos"> {
  const countries = ALT_COUNTRIES[primary(lang)] ?? [];
  const alternatives = [...(dto.alternative_titles?.titles ?? []), ...(dto.alternative_titles?.results ?? [])]
    .filter((alt) => countries.includes((alt.iso_3166_1 ?? "").toUpperCase()))
    .map((alt) => alt.title);
  const names = [dto.title ?? dto.name, dto.original_title ?? dto.original_name, ...alternatives]
    .filter((name): name is string => typeof name === "string" && name.trim() !== "");
  return {
    kind,
    names: [...new Set(names.map((name) => name.trim()))],
    originalLanguage: dto.original_language ? dto.original_language.toLowerCase() : null,
    releaseDate: (kind === "movie" ? dto.release_date : dto.first_air_date) || null,
    lastAirDate: kind === "tv" ? dto.last_air_date || null : null,
    ongoing: kind === "tv" && (dto.in_production === true || dto.status === "Returning Series"),
    countries: [...new Set([...(dto.origin_country ?? []), ...(dto.production_countries ?? []).map((c) => c.iso_3166_1 ?? "")].filter(Boolean))],
    seasons: (dto.seasons ?? [])
      .filter((s): s is { season_number: number; air_date?: string | null } => Number.isInteger(s.season_number))
      .map((s) => ({ season: s.season_number, airDate: s.air_date || null })),
  };
}

async function readTitle(tmdbId: number, kind: CatalogMediaType, lang: string | null, priority: CatalogPriority): Promise<TmdbTitle | null> {
  try {
    const params: Record<string, string> = {
      append_to_response: "videos,alternative_titles",
      include_video_language: videoLanguages(lang),
    };
    if (lang) params.language = lang;
    const dto = await withTimeout(tmdbFetch<TitleDto>(`/${kind}/${tmdbId}`, params, { priority }), priority);
    const title = tmdbTitleOf(kind, dto, lang);
    const videos = orderTmdbVideos(dto.videos?.results ?? []);
    const original = title.originalLanguage;
    if (videos.some(isTrailerType) || !original || original === primary(lang) || original === "en") return { ...title, videos };
    // Rien dans la langue du serveur ni en anglais : celles de la langue originale, après.
    const more = await withTimeout(
      tmdbFetch<{ results?: TmdbVideoDto[] }>(`/${kind}/${tmdbId}/videos`, { include_video_language: original }, { priority }),
      priority,
    ).catch(() => null);
    return { ...title, videos: [...videos, ...orderTmdbVideos(more?.results ?? [])] };
  } catch (err) {
    // Un titre que TMDB ne connaît pas n'a rien : ce n'est pas une panne.
    if (err instanceof TmdbError && err.status === 404) {
      return { kind, names: [], originalLanguage: null, releaseDate: null, lastAirDate: null, ongoing: false, countries: [], seasons: [], videos: [] };
    }
    return null;
  }
}

async function readSeasonVideos(tvId: number, season: number, lang: string | null, priority: CatalogPriority): Promise<TmdbVideo[] | null> {
  try {
    const dto = await withTimeout(
      tmdbFetch<{ results?: TmdbVideoDto[] }>(`/tv/${tvId}/season/${season}/videos`, { include_video_language: videoLanguages(lang) }, { priority }),
      priority,
    );
    return orderTmdbVideos(dto.results ?? []);
  } catch (err) {
    if (err instanceof TmdbError && err.status === 404) return [];
    return null;
  }
}

/** Le titre selon TMDB (mémoire partagée) ; `null` : TMDB n'a pas répondu. */
export function fetchTmdbTitle(tmdbId: number, kind: CatalogMediaType, lang: string | null, priority: CatalogPriority = "interactive"): Promise<TmdbTitle | null> {
  return remembered(`trailers:tmdb:${kind}:${tmdbId}:${lang ?? "-"}`, (p) => readTitle(tmdbId, kind, lang, p), (t) => ttlOf(t.videos), priority);
}

/** Les vidéos d'UNE saison selon TMDB (mémoire partagée) ; `null` : TMDB n'a pas répondu. */
export function fetchTmdbSeasonVideos(tvId: number, season: number, lang: string | null, priority: CatalogPriority = "interactive"): Promise<TmdbVideo[] | null> {
  return remembered(`trailers:tmdb:tv:${tvId}:s${season}:${lang ?? "-"}`, (p) => readSeasonVideos(tvId, season, lang, p), ttlOf, priority);
}
