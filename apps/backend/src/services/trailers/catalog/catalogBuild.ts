/* ------------------------------------------------------------------ */
/*  Le catalogue d'un titre : toutes les sources, une liste ordonnée    */
/*                                                                     */
/*  Pour chaque portée de la fiche (`catalogScopes`) : la bande-annonce */
/*  LOCALE, AlloCiné (serveur français, option cochée), TMDB (le titre */
/*  et ses saisons), les `RemoteTrailers` de Jellyfin, et Jellyseerr à */
/*  défaut de TMDB (ses noms et dates servent aussi à AlloCiné) — puis */
/*  le rang (`rankCatalogEntries`), huit au plus.                      */
/*  Toutes les sources partent ENSEMBLE ; au bout de 3 s, le serveur   */
/*  répond avec ce qu'il a (`complete: false`) et les autres finissent */
/*  en fond, pour la fois suivante (chaque source a sa mémoire         */
/*  partagée). Hors bibliothèque (`tmdbId`) : ni locale, ni Jellyfin.  */
/*  Rien n'est jamais écrit ailleurs que dans ces mémoires.            */
/*  En FOND (la préparation des aperçus à l'écran) : TMDB par sa file  */
/*  de fond, Dailymotion à sa cadence de préparation — et l'on dit si  */
/*  chaque source a VRAIMENT répondu (`answered`) : une décision prise */
/*  sans l'une d'elles ne serait pas celle du survol.                  */
/* ------------------------------------------------------------------ */

import { refreshTitleLanguage, titleLanguage } from "../../reco/titleLanguage";
import { tmdbConfigured } from "../../tmdb/client";
import { allocineActiveFor } from "../trailerSettings";
import { matchAllocineVideos, type AllocineMatchTitle } from "../allocine/allocineMatch";
import { searchAllocineVideos } from "../allocine/allocineSearch";
import type { TrailerCatalogRequest, TrailerCatalogResponse, TrailerEntry, TrailerScope } from "../../../trailers/trailerCatalog";
import { catalogScopes, rankCatalogEntries, type CatalogTarget } from "../../../trailers/trailerCatalogRank";
import { previewTmdbIdOf } from "../../../trailers/trailerPreview";
import { allocineEntries, jellyfinRemoteEntries, localEntries, youtubeEntries } from "./catalogEntries";
import { resolveCatalogTitle, type CatalogLibraryTitle } from "./catalogTitle";
import { fetchSeerrTitle } from "./seerrTitle";
import { fetchTmdbSeasonVideos, fetchTmdbTitle, type TmdbTitle } from "./tmdbCatalog";

export interface CatalogBuildOptions {
  /** `background` : la préparation des aperçus — personne n'attend encore. */
  priority?: "interactive" | "background";
}

/** Le catalogue, et si chaque source a vraiment répondu (TMDB, ses saisons, AlloCiné) — pas seulement à temps. */
export interface DetailedCatalog {
  response: TrailerCatalogResponse;
  answered: boolean;
}

/** Personne n'attend plus que ça : le reste arrive à la demande suivante. */
export const CATALOG_BUDGET_MS = 3_000;
/** La langue du serveur se lit vite, ou on fait sans. */
const LANGUAGE_WAIT_MS = 1_000;
/** Les saisons dont on demande les vidéos à TMDB, dans l'ordre des portées. */
const TMDB_SEASONS = 4;

type Settled<T> = { done: true; value: T } | { done: false };

function settleBy<T>(promise: Promise<T>, deadline: number): Promise<Settled<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ done: false }), Math.max(0, deadline - Date.now()));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ done: true, value });
      },
      () => {
        clearTimeout(timer);
        resolve({ done: true, value: null as T });
      },
    );
  });
}

/** La langue du SERVEUR (`fr-FR`) — celle des métadonnées de Jellyfin — ; à défaut, celle du client. */
async function serverLanguageTag(clientLang: string | undefined): Promise<string | null> {
  const read = refreshTitleLanguage().catch(() => titleLanguage());
  const settled = await settleBy(read, Date.now() + LANGUAGE_WAIT_MS);
  return (settled.done ? settled.value : titleLanguage()) ?? clientLang ?? null;
}

const primary = (lang: string | null) => (lang ?? "").slice(0, 2).toLowerCase() || null;

/** Ce qu'il faut pour chercher AlloCiné : TMDB (ou Jellyseerr) d'abord, Jellyfin à défaut. */
function allocineTitle(kind: "movie" | "tv", tmdb: TmdbTitle | null, library: CatalogLibraryTitle | null): AllocineMatchTitle {
  const tmdbSeasons = tmdb?.seasons.filter((s) => s.airDate) ?? [];
  return {
    kind,
    names: [...new Set([...(tmdb?.names ?? []), ...(library?.names ?? [])])],
    releaseDate: tmdb?.releaseDate ?? library?.releaseDate ?? null,
    lastAirDate: tmdb?.lastAirDate ?? library?.lastAirDate ?? null,
    seasons: tmdbSeasons.length > 0 ? tmdbSeasons : library?.seasons ?? [],
  };
}

const seasonScopes = (scopes: readonly TrailerScope[]) =>
  scopes.flatMap((scope) => (scope.kind === "season" ? [scope.season] : []));

/**
 * Le catalogue de la demande, vu par `userId`. Un titre absent ou invisible
 * pour ce compte : une liste vide, complète. Jellyfin muet : vide, à redemander.
 */
export async function buildCatalog(request: TrailerCatalogRequest, userId: string, budgetMs = CATALOG_BUDGET_MS): Promise<TrailerCatalogResponse> {
  return (await buildCatalogDetailed(request, userId, budgetMs)).response;
}

/** `buildCatalog`, avec ce que la préparation des aperçus doit savoir (`answered`). */
export async function buildCatalogDetailed(
  request: TrailerCatalogRequest, userId: string, budgetMs = CATALOG_BUDGET_MS, options: CatalogBuildOptions = {},
): Promise<DetailedCatalog> {
  const deadline = Date.now() + budgetMs;
  const background = options.priority === "background";
  const tmdbPriority = background ? "background" : "interactive";
  const languageTag = await serverLanguageTag(request.lang);
  const language = primary(languageTag);
  // Une source qui ne répond pas (TMDB muet, Dailymotion en pause ou refusé) : le catalogue n'est pas « répondu ».
  let answered = true;
  const heard = <T>(value: T | null): T | null => {
    if (value === null) answered = false;
    return value;
  };

  let library: CatalogLibraryTitle | null = null;
  let tmdbRef: { id: number; mediaType: "movie" | "tv" } | null = null;
  let requestedSeason: number | undefined;
  if ("itemId" in request) {
    const lookup = await resolveCatalogTitle(request.itemId, userId);
    if (lookup.kind !== "title") return { response: { entries: [], complete: lookup.kind === "none", language }, answered: lookup.kind === "none" };
    library = lookup.title;
    tmdbRef = library.tmdb;
    requestedSeason = library.season;
  } else {
    const id = previewTmdbIdOf(request.tmdbId);
    if (id === null) return { response: { entries: [], complete: true, language }, answered: true };
    tmdbRef = { id, mediaType: request.mediaType };
    requestedSeason = request.season;
  }
  const kind = tmdbRef?.mediaType ?? (library?.kind === "movie" ? "movie" : "tv");
  const isMovie = kind === "movie";
  const targetOf = (seasons: readonly number[]): CatalogTarget =>
    isMovie ? { kind: "movie" } : requestedSeason !== undefined ? { kind: "season", season: requestedSeason, seasons } : { kind: "series", seasons };
  const ownerScope: TrailerScope = isMovie ? { kind: "movie" } : { kind: "series" };

  // Toutes les sources partent ensemble. Jellyseerr (qui relaie TMDB) seulement sans TMDB, ou TMDB muet.
  const ref = tmdbRef;
  const tmdbTitle = ref && tmdbConfigured() ? fetchTmdbTitle(ref.id, ref.mediaType, languageTag, tmdbPriority).then(heard) : Promise.resolve(null);
  const seerrTitle = tmdbTitle.then((tmdb) => (tmdb || !ref ? null : fetchSeerrTitle(ref.id, ref.mediaType)));
  // Les noms, dates et saisons du titre : TMDB, sinon Jellyseerr.
  const titleInfo = tmdbTitle.then((tmdb) => tmdb ?? seerrTitle);
  const allocineQuery = allocineActiveFor(language)
    ? library?.names[0] ? Promise.resolve(library.names[0]) : titleInfo.then((t) => t?.names[0] ?? null)
    : Promise.resolve(null);
  const allocine = allocineQuery.then(async (query) => {
    if (!query) return [];
    const search = searchAllocineVideos(query, { ongoing: library?.ongoing ?? false, priority: background ? "prefetch" : "interactive" });
    const [info, found] = await Promise.all([titleInfo, search.then(heard)]);
    if (!found) return [];
    return allocineEntries(matchAllocineVideos(found.videos, allocineTitle(kind, info, library)));
  });
  const knownSeasons = titleInfo.then((info) => [...new Set([...(library?.seasons.map((s) => s.season) ?? []), ...(info?.seasons.map((s) => s.season) ?? [])])]);
  // Les noms du titre : une vidéo qui en nomme un AUTRE est écartée (`foreignTitleGuard.ts`).
  const namesOf = (info: TmdbTitle | null) => [...new Set([...(info?.names ?? []), ...(library?.names ?? [])])];
  const tmdbEntries = tmdbTitle.then(async (tmdb) => {
    if (!tmdb || !tmdbRef) return [];
    const names = namesOf(tmdb);
    const own = youtubeEntries(tmdb.videos, ownerScope, "tmdb", languageTag, names);
    if (isMovie) return own;
    const wanted = seasonScopes(catalogScopes(targetOf(await knownSeasons))).slice(0, TMDB_SEASONS);
    const tvId = tmdbRef.id;
    const perSeason = await Promise.all(wanted.map(async (season) => {
      const videos = heard(await fetchTmdbSeasonVideos(tvId, season, languageTag, tmdbPriority));
      return videos ? youtubeEntries(videos, { kind: "season", season }, "tmdb", languageTag, names) : [];
    }));
    return [...own, ...perSeason.flat()];
  });
  const seerr = seerrTitle.then((title) => (title ? youtubeEntries(title.videos, ownerScope, "seerr", languageTag, namesOf(title)) : []));

  const sources: Array<Promise<TrailerEntry[]>> = [
    Promise.resolve(library ? localEntries(library.local, languageTag) : []),
    allocine,
    tmdbEntries,
    titleInfo.then((info) => (library ? jellyfinRemoteEntries(library.remote, ownerScope, languageTag, namesOf(info)) : [])),
    seerr,
  ];
  const settled = await Promise.all(sources.map((source) => settleBy(source, deadline)));
  const seasonsSettled = await settleBy(knownSeasons, deadline);
  const entries = settled.flatMap((s) => (s.done && s.value ? s.value : []));
  const seasons = seasonsSettled.done && seasonsSettled.value ? seasonsSettled.value : library?.seasons.map((s) => s.season) ?? [];
  const complete = settled.every((s) => s.done) && seasonsSettled.done;
  return {
    response: { entries: rankCatalogEntries(entries, catalogScopes(targetOf(seasons))), complete, language },
    answered: complete && answered,
  };
}
