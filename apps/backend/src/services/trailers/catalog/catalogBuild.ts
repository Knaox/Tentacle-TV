/* ------------------------------------------------------------------ */
/*  Le catalogue d'un titre : toutes les sources, une liste ordonnée    */
/*                                                                     */
/*  Pour chaque portée de la fiche (`catalogScopes`) : la bande-annonce */
/*  LOCALE, AlloCiné (serveur français, option cochée), TMDB (le titre */
/*  et ses saisons), les `RemoteTrailers` de Jellyfin, et Jellyseerr à */
/*  défaut de TMDB — puis le rang (`rankCatalogEntries`), huit au plus.*/
/*  Toutes les sources partent ENSEMBLE ; au bout de 3 s, le serveur   */
/*  répond avec ce qu'il a (`complete: false`) et les autres finissent */
/*  en fond, pour la fois suivante (chaque source a sa mémoire         */
/*  partagée). Hors bibliothèque (`tmdbId`) : ni locale, ni Jellyfin.  */
/*  Rien n'est jamais écrit ailleurs que dans ces mémoires.            */
/* ------------------------------------------------------------------ */

import { refreshTitleLanguage, titleLanguage } from "../../reco/titleLanguage";
import { tmdbConfigured } from "../../tmdb/client";
import { fetchSeerrVideos } from "../titleVideos";
import { allocineActiveFor } from "../trailerSettings";
import { matchAllocineVideos, type AllocineMatchTitle } from "../allocine/allocineMatch";
import { searchAllocineVideos } from "../allocine/allocineSearch";
import type { TrailerCatalogRequest, TrailerCatalogResponse, TrailerEntry, TrailerScope } from "../../../trailers/trailerCatalog";
import { catalogScopes, rankCatalogEntries, type CatalogTarget } from "../../../trailers/trailerCatalogRank";
import { previewTmdbIdOf } from "../../../trailers/trailerPreview";
import type { TmdbVideo } from "../../../trailers/trailerList";
import { days, remembered } from "./catalogMemory";
import { allocineEntries, jellyfinRemoteEntries, localEntries, youtubeEntries } from "./catalogEntries";
import { resolveCatalogTitle, type CatalogLibraryTitle } from "./catalogTitle";
import { fetchTmdbSeasonVideos, fetchTmdbTitle, type TmdbTitle } from "./tmdbCatalog";

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

/** Jellyseerr à défaut de TMDB : sa liste gardée un jour pour tous. */
function seerrVideos(tmdbId: number, mediaType: "movie" | "tv"): Promise<TmdbVideo[] | null> {
  return remembered(`trailers:seerr:${mediaType}:${tmdbId}`, () => fetchSeerrVideos(tmdbId, mediaType), () => days(1));
}

/** Ce qu'il faut pour chercher AlloCiné : TMDB d'abord, Jellyfin à défaut (aucune clé TMDB). */
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
  const deadline = Date.now() + budgetMs;
  const languageTag = await serverLanguageTag(request.lang);
  const language = primary(languageTag);

  let library: CatalogLibraryTitle | null = null;
  let tmdbRef: { id: number; mediaType: "movie" | "tv" } | null = null;
  let requestedSeason: number | undefined;
  if ("itemId" in request) {
    const lookup = await resolveCatalogTitle(request.itemId, userId);
    if (lookup.kind !== "title") return { entries: [], complete: lookup.kind === "none", language };
    library = lookup.title;
    tmdbRef = library.tmdb;
    requestedSeason = library.season;
  } else {
    const id = previewTmdbIdOf(request.tmdbId);
    if (id === null) return { entries: [], complete: true, language };
    tmdbRef = { id, mediaType: request.mediaType };
    requestedSeason = request.season;
  }
  const kind = tmdbRef?.mediaType ?? (library?.kind === "movie" ? "movie" : "tv");
  const isMovie = kind === "movie";
  const targetOf = (seasons: readonly number[]): CatalogTarget =>
    isMovie ? { kind: "movie" } : requestedSeason !== undefined ? { kind: "season", season: requestedSeason, seasons } : { kind: "series", seasons };
  const ownerScope: TrailerScope = isMovie ? { kind: "movie" } : { kind: "series" };

  // Toutes les sources partent ensemble.
  const tmdbTitle = tmdbRef && tmdbConfigured() ? fetchTmdbTitle(tmdbRef.id, tmdbRef.mediaType, languageTag) : Promise.resolve(null);
  const allocineQuery = allocineActiveFor(language)
    ? library?.names[0] ? Promise.resolve(library.names[0]) : tmdbTitle.then((t) => t?.names[0] ?? null)
    : Promise.resolve(null);
  const allocine = allocineQuery.then(async (query) => {
    if (!query) return [];
    const ongoing = library?.ongoing ?? false;
    const [found, tmdb] = await Promise.all([searchAllocineVideos(query, { ongoing }), tmdbTitle]);
    return found ? allocineEntries(matchAllocineVideos(found.videos, allocineTitle(kind, tmdb, library))) : [];
  });
  const knownSeasons = tmdbTitle.then((tmdb) => [...new Set([...(library?.seasons.map((s) => s.season) ?? []), ...(tmdb?.seasons.map((s) => s.season) ?? [])])]);
  const tmdbEntries = tmdbTitle.then(async (tmdb) => {
    if (!tmdb || !tmdbRef) return [];
    const own = youtubeEntries(tmdb.videos, ownerScope, "tmdb", languageTag);
    if (isMovie) return own;
    const wanted = seasonScopes(catalogScopes(targetOf(await knownSeasons))).slice(0, TMDB_SEASONS);
    const tvId = tmdbRef.id;
    const perSeason = await Promise.all(wanted.map(async (season) => {
      const videos = await fetchTmdbSeasonVideos(tvId, season, languageTag);
      return videos ? youtubeEntries(videos, { kind: "season", season }, "tmdb", languageTag) : [];
    }));
    return [...own, ...perSeason.flat()];
  });
  // Jellyseerr : seulement sans TMDB (sa liste est celle de TMDB), ou quand TMDB n'a pas répondu.
  const seerr = tmdbTitle.then(async (tmdb) => {
    if (tmdb || !tmdbRef) return [];
    const videos = await seerrVideos(tmdbRef.id, tmdbRef.mediaType);
    return videos ? youtubeEntries(videos, ownerScope, "seerr", languageTag) : [];
  });

  const sources: Array<Promise<TrailerEntry[]>> = [
    Promise.resolve(library ? localEntries(library.local, languageTag) : []),
    allocine,
    tmdbEntries,
    Promise.resolve(library ? jellyfinRemoteEntries(library.remote, ownerScope, languageTag) : []),
    seerr,
  ];
  const settled = await Promise.all(sources.map((source) => settleBy(source, deadline)));
  const seasonsSettled = await settleBy(knownSeasons, deadline);
  const entries = settled.flatMap((s) => (s.done && s.value ? s.value : []));
  const seasons = seasonsSettled.done && seasonsSettled.value ? seasonsSettled.value : library?.seasons.map((s) => s.season) ?? [];
  return {
    entries: rankCatalogEntries(entries, catalogScopes(targetOf(seasons))),
    complete: settled.every((s) => s.done) && seasonsSettled.done,
    language,
  };
}
