/* ------------------------------------------------------------------ */
/*  Le titre d'un catalogue, tel que le compte de la requête le voit    */
/*                                                                     */
/*  Lu AU NOM du compte (clé d'administration + son `userId`, comme    */
/*  `preview/previewTitle.ts` : Jellyfin rend 404 pour ce que ce       */
/*  compte ne voit pas). Un film ou une série vaut lui-même ; une      */
/*  saison ou un épisode valent la saison qu'ils désignent, DANS leur  */
/*  série. On y lit : les saisons de la série (`/Shows/{id}/Seasons`), */
/*  les identifiants TMDB, les `RemoteTrailers` de la série ou du film,*/
/*  les bandes-annonces LOCALES (posées par l'administrateur) de la    */
/*  série, du film et de chaque saison qui en a, et de quoi chercher   */
/*  AlloCiné même sans clé TMDB (noms et dates de Jellyfin). Gardé dix */
/*  minutes par (compte, titre) — le survol d'un aperçu le relit à     */
/*  chaque fois — ; deux demandes partagent tout.                      */
/* ------------------------------------------------------------------ */

import { jellyfinAdminFetch } from "../../jellyfinAdminFetch";
import type { JellyfinTrailer } from "../../../trailers/trailerList";
import type { TrailerScope } from "../../../trailers/trailerCatalog";
import { previewItemIdOf, previewTmdbIdOf } from "../../../trailers/trailerPreview";
import { TtlLru } from "../preview/ttlLru";

export interface LocalTrailer {
  scope: TrailerScope;
  itemId: string;
  name: string;
}

export interface LibrarySeason {
  season: number;
  airDate: string | null;
}

export interface CatalogLibraryTitle {
  /** Le film ou la série : la clé de ce qui se partage entre comptes. */
  ownerId: string;
  kind: "movie" | "series" | "season";
  /** La saison visée (une saison, ou celle d'un épisode). */
  season?: number;
  seasons: LibrarySeason[];
  tmdb: { id: number; mediaType: "movie" | "tv" } | null;
  remote: JellyfinTrailer[];
  local: LocalTrailer[];
  /** Selon Jellyfin (langue de ses métadonnées) : de quoi chercher AlloCiné sans TMDB. */
  names: string[];
  releaseDate: string | null;
  lastAirDate: string | null;
  ongoing: boolean;
}

export type CatalogTitleLookup = { kind: "title"; title: CatalogLibraryTitle } | { kind: "none" } | { kind: "error" };

interface ItemDto {
  Id?: string;
  Type?: string;
  Name?: string;
  OriginalTitle?: string;
  SeriesId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  PremiereDate?: string;
  EndDate?: string;
  Status?: string;
  ProviderIds?: Record<string, string>;
  RemoteTrailers?: Array<{ Url?: string; Name?: string }>;
  LocalTrailerCount?: number;
}

const FIELDS = "ProviderIds,RemoteTrailers,LocalTrailerCount,OriginalTitle";
const TIMEOUT_MS = 5_000;
const LOOKUP_TTL_MS = 10 * 60 * 1000;
const lookups = new TtlLru<CatalogTitleLookup>(1000);
const inflight = new Map<string, Promise<CatalogTitleLookup>>();

type Read<T> = T | "missing" | "error";

async function read<T>(path: string): Promise<Read<T>> {
  const result = await jellyfinAdminFetch<T>(path, { timeoutMs: TIMEOUT_MS });
  if (result.ok) return result.data;
  return result.failure === "invalid" && (result.status === 404 || result.status === 400) ? "missing" : "error";
}

const readItem = (itemId: string, userId: string) =>
  read<ItemDto>(`/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}&Fields=${FIELDS}`);

const day = (date: string | undefined) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null);

async function readLocalTrailers(itemId: string, userId: string, scope: TrailerScope): Promise<LocalTrailer[]> {
  const list = await read<ItemDto[]>(`/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/LocalTrailers`);
  if (!Array.isArray(list)) return [];
  return list.flatMap((trailer) => {
    const id = previewItemIdOf(trailer.Id);
    return id ? [{ scope, itemId: id, name: trailer.Name ?? "" }] : [];
  });
}

async function lookup(itemId: string, userId: string): Promise<CatalogTitleLookup> {
  const item = await readItem(itemId, userId);
  if (item === "error") return { kind: "error" };
  if (item === "missing") return { kind: "none" };
  const isPart = item.Type === "Episode" || item.Type === "Season";
  if (!isPart && item.Type !== "Movie" && item.Type !== "Series") return { kind: "none" };
  const owner = isPart && item.SeriesId ? await readItem(item.SeriesId, userId) : item;
  if (owner === "error") return { kind: "error" };
  if (owner === "missing" || (isPart && !item.SeriesId)) return { kind: "none" };
  const ownerId = previewItemIdOf(owner.Id);
  if (!ownerId) return { kind: "none" };
  const isMovie = owner.Type === "Movie";

  const seasonItems: Read<{ Items?: ItemDto[] }> = isMovie ? { Items: [] } : await read<{ Items?: ItemDto[] }>(
    `/Shows/${encodeURIComponent(ownerId)}/Seasons?userId=${encodeURIComponent(userId)}&Fields=LocalTrailerCount`,
  );
  if (seasonItems === "error") return { kind: "error" };
  const seasonList: ItemDto[] = seasonItems === "missing" ? [] : (seasonItems.Items ?? []);
  const seasons = seasonList
    .filter((s): s is ItemDto & { IndexNumber: number } => Number.isInteger(s.IndexNumber))
    .map((s) => ({ season: s.IndexNumber, airDate: day(s.PremiereDate) }));

  // Les locales : celles du film ou de la série, et celles des saisons qui en ont.
  const ownerScope: TrailerScope = isMovie ? { kind: "movie" } : { kind: "series" };
  const localReads = [(owner.LocalTrailerCount ?? 0) > 0 ? readLocalTrailers(ownerId, userId, ownerScope) : Promise.resolve([])];
  for (const s of seasonList) {
    if ((s.LocalTrailerCount ?? 0) > 0 && s.Id && Number.isInteger(s.IndexNumber) && (s.IndexNumber as number) > 0) {
      localReads.push(readLocalTrailers(s.Id, userId, { kind: "season", season: s.IndexNumber as number }));
    }
  }
  const local = (await Promise.all(localReads)).flat();

  const season = item.Type === "Season" ? item.IndexNumber : item.Type === "Episode" ? item.ParentIndexNumber : undefined;
  const tmdbId = previewTmdbIdOf(owner.ProviderIds?.Tmdb);
  const title: CatalogLibraryTitle = {
    ownerId,
    kind: isMovie ? "movie" : season !== undefined && Number.isInteger(season) ? "season" : "series",
    seasons,
    tmdb: tmdbId === null ? null : { id: tmdbId, mediaType: isMovie ? "movie" : "tv" },
    remote: (owner.RemoteTrailers ?? []).filter((t): t is JellyfinTrailer => typeof t.Url === "string" && t.Url !== ""),
    local,
    names: [...new Set([owner.Name, owner.OriginalTitle].filter((n): n is string => !!n && n.trim() !== ""))],
    releaseDate: day(owner.PremiereDate),
    lastAirDate: isMovie ? null : day(owner.EndDate),
    ongoing: !isMovie && owner.Status === "Continuing",
  };
  if (title.kind === "season") title.season = season;
  return { kind: "title", title };
}

/** Le titre que `itemId` désigne, vu par `userId` ; deux demandes simultanées partagent la lecture. */
export function resolveCatalogTitle(itemId: string, userId: string): Promise<CatalogTitleLookup> {
  const cacheKey = `${userId}:${itemId}`;
  const known = lookups.get(cacheKey);
  if (known) return Promise.resolve(known);
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const task = lookup(itemId, userId)
    .then((result) => {
      // Une panne de Jellyfin ne se retient pas : la demande suivante relit.
      if (result.kind !== "error") lookups.set(cacheKey, result, LOOKUP_TTL_MS);
      return result;
    })
    .finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, task);
  return task;
}

/** Pour les tests. */
export function resetCatalogTitles(): void {
  lookups.clear();
  inflight.clear();
}
