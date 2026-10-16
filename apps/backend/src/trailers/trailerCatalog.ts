/**
 * Le CATALOGUE des bandes-annonces d'un titre — le contrat de
 * `GET /api/trailers/catalog`, que le serveur déclare par la capacité
 * `trailers.catalog`.
 *
 * Le client fait UN appel ; le serveur rend la liste ORDONNÉE de tout ce qui
 * se joue pour ce titre — la saison de l'épisode d'abord, puis les saisons
 * d'avant, la série, et seulement ensuite les saisons suivantes (elles
 * divulgâchent) — et, dans chaque portée, la langue du SERVEUR d'abord
 * (`trailerCatalogRank.ts`). Le client prend la première entrée qu'il sait
 * lire ; il ne trie rien lui-même.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/trailers/` avec
 * `trailerCatalogRank.ts` et `trailerPreview.ts`, qu'il importe (le backend
 * ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/trailers/{trailerCatalog,trailerCatalogRank}.ts apps/backend/src/trailers/
 *
 * `trailersMirror.test.ts` (backend) refuse toute divergence.
 */

import { previewItemIdOf, previewLangOf, previewTmdbIdOf } from "./trailerPreview";

/** La route, préfixe compris. */
export const TRAILER_CATALOG_ROUTE = "/api/trailers/catalog";

/** Au-delà, la fiche n'en montrerait de toute façon pas davantage. */
export const TRAILER_CATALOG_MAX_ENTRIES = 8;

/** Ce que couvre une bande-annonce : le film, la série entière, ou UNE saison (numérotée à partir de 1). */
export type TrailerScope = { kind: "movie" } | { kind: "series" } | { kind: "season"; season: number };

/**
 * Comment la jouer :
 * - `jellyfin` : une bande-annonce LOCALE posée par l'administrateur, un titre
 *   de la bibliothèque (lecteur habituel) ;
 * - `youtube` / `dailymotion` : une vidéo en ligne, toujours lue par le relais
 *   du serveur (aucune publicité) — jamais une adresse à ouvrir telle quelle.
 */
export type TrailerPlayback =
  | { kind: "jellyfin"; itemId: string }
  | { kind: "youtube"; ytId: string }
  | { kind: "dailymotion"; videoId: string };

/**
 * La version, par rapport à la langue du SERVEUR (celle de ses métadonnées) :
 * - `localized` : parlée dans cette langue — la « VF » d'un serveur français,
 *   la version anglaise d'un serveur anglais ;
 * - `subtitled` : la version originale sous-titrée dans cette langue (VOSTFR,
 *   « VO STFR » — souvent doublée en fait, d'où son rang juste après) ;
 * - `original` : une autre langue, sans sous-titres annoncés dans la sienne (VO) ;
 * - `unknown` : rien ne le dit (une bande-annonce de Jellyfin sans libellé).
 */
export type TrailerVersion = "localized" | "subtitled" | "original" | "unknown";

/**
 * La piste audio que le relais JOUE, quand la vidéo en a plusieurs :
 * l'originale ou un doublage humain — jamais un doublage automatique par IA,
 * que le serveur retire. `lang` : la langue de YouTube (`fr-FR`, `en`).
 */
export interface TrailerAudio {
  content: "original" | "dubbed";
  lang: string;
}

export type TrailerSource = "local" | "allocine" | "tmdb" | "jellyfin" | "seerr";

export interface TrailerEntry {
  scope: TrailerScope;
  playback: TrailerPlayback;
  /** Le libellé de la source (« Rick et Morty - saison 6 Bande-annonce VF »), à montrer tel quel. */
  name: string;
  version: TrailerVersion;
  type: "trailer" | "teaser";
  source: TrailerSource;
}

/** 200 — la liste, la meilleure en tête ; `complete: false` : une source n'a pas fini, redemander plus tard. */
export interface TrailerCatalogResponse {
  entries: TrailerEntry[];
  complete: boolean;
  /** La langue qui a décidé des versions (celle du serveur, `fr`, `en`…) ; `null` si inconnue. */
  language: string | null;
}

export type TrailerCatalogMediaType = "movie" | "tv";

/**
 * La demande : un titre de la bibliothèque (film, série, saison ou épisode),
 * ou un titre TMDB (hors bibliothèque, Vigie) — une série TMDB peut viser une
 * saison. `lang` (l'interface) ne sert que si le serveur ne connaît pas encore
 * sa propre langue.
 */
export type TrailerCatalogRequest = (
  | { itemId: string }
  | { tmdbId: number | string; mediaType: TrailerCatalogMediaType; season?: number }
) & { lang?: string };

/** Les refus : 400 `invalid_request` (demande illisible), 429 `rate_limited` (`Retry-After`). */
export type TrailerCatalogRefusal = "invalid_request" | "rate_limited";

const SEASON_RE = /^(?:0|[1-9]\d{0,2})$/;
const YT_ID_RE = /^[\w-]{11}$/;
const DM_ID_RE = /^[a-zA-Z0-9]{5,12}$/;

/** Un numéro de saison lisible (0 à 999), en nombre ou en texte ; `null` sinon. */
export function catalogSeasonOf(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && SEASON_RE.test(text) ? Number(text) : null;
}

function single(value: unknown): unknown {
  return Array.isArray(value) ? undefined : value;
}

/**
 * La demande que porte une requête — lue avec les MÊMES règles que
 * `trailerCatalogPath` l'écrit. `null` : illisible (aucun titre, deux à la
 * fois, un identifiant mal formé, une saison sur un film).
 */
export function parseTrailerCatalogQuery(query: Readonly<Record<string, unknown>>): TrailerCatalogRequest | null {
  const rawItem = single(query.itemId);
  const lang = previewLangOf(single(query.lang));
  const withLang = <T extends object>(target: T) => (lang ? { ...target, lang } : target);
  if (rawItem !== undefined && rawItem !== "") {
    if (query.tmdbId !== undefined || query.mediaType !== undefined || query.season !== undefined) return null;
    const itemId = previewItemIdOf(rawItem);
    return itemId ? withLang({ itemId }) : null;
  }
  const tmdbId = previewTmdbIdOf(single(query.tmdbId));
  const rawType = single(query.mediaType);
  const mediaType: TrailerCatalogMediaType | null = rawType === "movie" || rawType === "tv" ? rawType : null;
  if (tmdbId === null || !mediaType) return null;
  const rawSeason = single(query.season);
  if (rawSeason === undefined || rawSeason === "") return withLang({ tmdbId, mediaType });
  const season = catalogSeasonOf(rawSeason);
  return season !== null && mediaType === "tv" ? withLang({ tmdbId, mediaType, season }) : null;
}

/** Le chemin de la demande (`/api/trailers/catalog?…`) ; `null` pour une demande illisible. */
export function trailerCatalogPath(request: TrailerCatalogRequest): string | null {
  const params: string[] = [];
  if ("itemId" in request) {
    const itemId = previewItemIdOf(request.itemId);
    if (!itemId) return null;
    params.push(`itemId=${itemId}`);
  } else {
    const tmdbId = previewTmdbIdOf(request.tmdbId);
    if (tmdbId === null || (request.mediaType !== "movie" && request.mediaType !== "tv")) return null;
    params.push(`tmdbId=${tmdbId}`, `mediaType=${request.mediaType}`);
    if (request.season !== undefined) {
      const season = catalogSeasonOf(request.season);
      if (season === null || request.mediaType !== "tv") return null;
      params.push(`season=${season}`);
    }
  }
  const lang = previewLangOf(request.lang);
  if (lang) params.push(`lang=${encodeURIComponent(lang)}`);
  return `${TRAILER_CATALOG_ROUTE}?${params.join("&")}`;
}

/** La clé d'une portée (`movie`, `series`, `s3`) : comparer, regrouper, nommer une mémoire. */
export function trailerScopeKey(scope: TrailerScope): string {
  return scope.kind === "season" ? `s${scope.season}` : scope.kind;
}

/** La clé d'une lecture (`jf:…`, `yt:…`, `dm:…`) : deux sources qui rendent la même vidéo n'en font qu'une. */
export function trailerPlaybackKey(playback: TrailerPlayback): string {
  if (playback.kind === "jellyfin") return `jf:${playback.itemId}`;
  return playback.kind === "youtube" ? `yt:${playback.ytId}` : `dm:${playback.videoId}`;
}

function readScope(value: unknown): TrailerScope | null {
  if (!value || typeof value !== "object") return null;
  const scope = value as { kind?: unknown; season?: unknown };
  if (scope.kind === "movie" || scope.kind === "series") return { kind: scope.kind };
  const season = scope.kind === "season" ? catalogSeasonOf(scope.season) : null;
  return season !== null && season > 0 ? { kind: "season", season } : null;
}

function readPlayback(value: unknown): TrailerPlayback | null {
  if (!value || typeof value !== "object") return null;
  const playback = value as { kind?: unknown; itemId?: unknown; ytId?: unknown; videoId?: unknown };
  if (playback.kind === "jellyfin") {
    const itemId = previewItemIdOf(playback.itemId);
    return itemId ? { kind: "jellyfin", itemId } : null;
  }
  if (playback.kind === "youtube") return typeof playback.ytId === "string" && YT_ID_RE.test(playback.ytId) ? { kind: "youtube", ytId: playback.ytId } : null;
  if (playback.kind === "dailymotion") {
    return typeof playback.videoId === "string" && DM_ID_RE.test(playback.videoId) ? { kind: "dailymotion", videoId: playback.videoId } : null;
  }
  return null;
}

const VERSIONS: readonly string[] = ["localized", "subtitled", "original", "unknown"];
const SOURCES: readonly string[] = ["local", "allocine", "tmdb", "jellyfin", "seerr"];

/**
 * Lecture DÉFENSIVE d'une réponse 200 : une entrée illisible est écartée (un
 * serveur plus récent peut en apporter d'un genre nouveau), une réponse
 * illisible vaut `null` — le comportement d'avant.
 */
export function readTrailerCatalog(value: unknown): TrailerCatalogResponse | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { entries?: unknown; complete?: unknown; language?: unknown };
  if (!Array.isArray(body.entries)) return null;
  const entries: TrailerEntry[] = [];
  for (const raw of body.entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const scope = readScope(entry.scope);
    const playback = readPlayback(entry.playback);
    if (!scope || !playback || typeof entry.name !== "string") continue;
    if (typeof entry.version !== "string" || !VERSIONS.includes(entry.version)) continue;
    if (typeof entry.source !== "string" || !SOURCES.includes(entry.source)) continue;
    if (entry.type !== "trailer" && entry.type !== "teaser") continue;
    entries.push({
      scope, playback, name: entry.name, version: entry.version as TrailerVersion, type: entry.type, source: entry.source as TrailerSource,
    });
  }
  return { entries, complete: body.complete !== false, language: typeof body.language === "string" ? body.language : null };
}
