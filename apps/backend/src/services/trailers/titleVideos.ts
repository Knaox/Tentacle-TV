/* ------------------------------------------------------------------ */
/*  Les vidéos d'un titre selon TMDB — de quoi choisir une bande-annonce */
/*                                                                     */
/*  Par la clé TMDB de CE serveur (client cadencé) : la langue         */
/*  demandée, l'anglais et les vidéos sans langue — sans paramètre,    */
/*  TMDB ne rend que l'anglais (mesuré : Dune, 56 vidéos `en`, aucune  */
/*  des cinq VF). S'il n'y a là ni bande-annonce ni teaser, la langue  */
/*  ORIGINALE du titre (un film japonais n'a parfois que les siennes). */
/*  Sans clé, ou TMDB muet, la liste de Jellyseerr (extension Vigie) — */
/*  celle que sert `/api/tmdb/trailers` depuis toujours.               */
/* ------------------------------------------------------------------ */

import { TmdbError, tmdbConfigured, tmdbFetch } from "../tmdb/client";
import { getSeerrConfig } from "../seerConfig";
import { hasSubtitleMark, trailerKind, trailerOrdinal, type TmdbVideo } from "../../trailers/trailerList";

export type TitleMediaType = "movie" | "tv";

export interface TitleVideos {
  videos: TmdbVideo[];
  /** `false` : une source n'a pas répondu — une liste vide n'y vaut pas « aucune bande-annonce ». */
  complete: boolean;
}

/** Une vidéo telle que TMDB la décrit (`/movie/{id}/videos`). */
export interface TmdbVideoDto {
  key?: string;
  name?: string;
  type?: string;
  site?: string;
  iso_639_1?: string | null;
  official?: boolean;
  size?: number;
  published_at?: string;
}

interface TmdbTitleDto {
  original_language?: string;
  videos?: { results?: TmdbVideoDto[] };
}

/** Le client TMDB n'a pas de délai à lui : au-delà, la décision se passe de TMDB. */
const TMDB_TIMEOUT_MS = 8_000;
const SEERR_TIMEOUT_MS = 8_000;

const youtubeUrl = (key: string) => `https://www.youtube.com/watch?v=${key}`;
const isTrailerType = (type: string | undefined) => /^(trailer|teaser)$/i.test(type ?? "");

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`délai de ${ms} ms dépassé`)), ms);
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

/**
 * Les vidéos YouTube de TMDB, dans l'ordre où les essayer à langue et type
 * égaux (les tris qui suivent sont stables) : une VF avant une VOST, la
 * bande-annonce 1 avant la 2 (`trailerOrdinal`), la vidéo officielle, la plus
 * haute définition, puis la PLUS ANCIENNE — la bande-annonce de la sortie, pas
 * celle d'une ressortie ; pour une série, celle de son lancement.
 */
export function orderTmdbVideos(results: readonly TmdbVideoDto[]): TmdbVideo[] {
  const usable = results.filter((v) => (v.site ?? "").toLowerCase() === "youtube" && !!v.key);
  const score = (v: TmdbVideoDto) => [
    hasSubtitleMark(v.name) ? 1 : 0, trailerOrdinal(v.name), v.official === false ? 1 : 0, -(v.size ?? 0),
  ];
  const sorted = [...usable].sort((a, b) => {
    const [x, y] = [score(a), score(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return (a.published_at ?? "").localeCompare(b.published_at ?? "");
  });
  return sorted.map((v) => ({
    key: v.key as string, name: v.name, type: v.type, site: "YouTube", lang: v.iso_639_1 ?? undefined, url: youtubeUrl(v.key as string),
  }));
}

/** Les langues à demander à TMDB : celle de l'interface, l'anglais, et les vidéos sans langue. */
function languagesFor(lang: string | undefined): string {
  return [...new Set([lang, "en"].filter(Boolean)), "null"].join(",");
}

/** Les vidéos du titre selon TMDB (clé du serveur) ; `null` : TMDB n'a pas répondu. */
export async function fetchTmdbVideos(tmdbId: number, mediaType: TitleMediaType, lang: string | undefined): Promise<TmdbVideo[] | null> {
  try {
    const title = await withTimeout(
      tmdbFetch<TmdbTitleDto>(`/${mediaType}/${tmdbId}`, { append_to_response: "videos", include_video_language: languagesFor(lang) }),
      TMDB_TIMEOUT_MS,
    );
    const videos = orderTmdbVideos(title.videos?.results ?? []);
    const original = title.original_language?.toLowerCase();
    if (videos.some((v) => isTrailerType(v.type)) || !original || original === lang || original === "en") return videos;
    // Rien dans la langue demandée ni en anglais : celles de la langue originale, après.
    const more = await withTimeout(
      tmdbFetch<{ results?: TmdbVideoDto[] }>(`/${mediaType}/${tmdbId}/videos`, { include_video_language: original }),
      TMDB_TIMEOUT_MS,
    ).catch(() => null);
    return [...videos, ...orderTmdbVideos(more?.results ?? [])];
  } catch (err) {
    // Un titre que TMDB ne connaît pas n'a pas de vidéos : ce n'est pas une panne.
    if (err instanceof TmdbError && err.status === 404) return [];
    return null;
  }
}

/**
 * Les vidéos liées d'un titre selon Jellyseerr (extension Vigie) : bandes-
 * annonces et teasers seulement (`trailerKind`), YouTube seulement, la
 * bande-annonce 1 avant la 2. `null` : Jellyseerr absent ou muet.
 */
export async function fetchSeerrVideos(tmdbId: number | string, mediaType: TitleMediaType): Promise<TmdbVideo[] | null> {
  const seerr = getSeerrConfig();
  if (!seerr) return null;
  try {
    const res = await fetch(`${seerr.url}/api/v1/${mediaType}/${encodeURIComponent(String(tmdbId))}`, {
      headers: { "X-Api-Key": seerr.apiKey },
      signal: AbortSignal.timeout(SEERR_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      relatedVideos?: Array<{ url?: string; key?: string; name?: string; type?: string; site?: string; iso_639_1?: string }>;
    };
    return (data.relatedVideos ?? [])
      .filter((v) => (v.site ?? "YouTube").toLowerCase() === "youtube" && (v.key || v.url))
      .map((v) => ({
        key: v.key ?? "",
        name: v.name,
        type: v.type,
        site: v.site ?? "YouTube",
        lang: v.iso_639_1,
        url: v.url || (v.key ? youtubeUrl(v.key) : ""),
      }))
      // Jamais un bonus (interview, coulisses, extrait…) : même un client d'avant 1.31.0 ne le proposera plus.
      .filter((v) => v.url && trailerKind({ Url: v.url, Name: v.name, type: v.type }) !== "other")
      .sort((a, b) => trailerOrdinal(a.name) - trailerOrdinal(b.name));
  } catch {
    return null;
  }
}

/**
 * Les vidéos d'un titre : TMDB par la clé du serveur, sinon (pas de clé,
 * TMDB muet) Jellyseerr. Sans aucune source réglée, une liste vide COMPLÈTE :
 * il n'y a rien à attendre de plus.
 */
export async function fetchTitleVideos(tmdbId: number, mediaType: TitleMediaType, lang: string | undefined): Promise<TitleVideos> {
  const fromTmdb = tmdbConfigured() ? await fetchTmdbVideos(tmdbId, mediaType, lang) : null;
  if (fromTmdb) return { videos: fromTmdb, complete: true };
  const fromSeerr = await fetchSeerrVideos(tmdbId, mediaType);
  if (fromSeerr) return { videos: fromSeerr, complete: true };
  return { videos: [], complete: !tmdbConfigured() && !getSeerrConfig() };
}
