/* ------------------------------------------------------------------ */
/*  Le titre d'un aperçu, tel que le compte de la requête le voit       */
/*                                                                     */
/*  Un titre de la bibliothèque est lu AU NOM du compte (clé           */
/*  d'administration + son `userId` : Jellyfin rend 404 pour ce que    */
/*  ce compte ne voit pas — bibliothèque non partagée, contrôle        */
/*  parental — et un 400 sans `userId`). Un épisode ou une saison      */
/*  valent leur SÉRIE ; une collection, une personne, de la musique,   */
/*  un dossier n'ont pas de bande-annonce. Un titre TMDB (carte hors   */
/*  bibliothèque) se passe de Jellyfin. Gardé deux minutes par compte. */
/* ------------------------------------------------------------------ */

import { jellyfinAdminFetch } from "../../jellyfinAdminFetch";
import type { JellyfinTrailer } from "../../../trailers/trailerList";
import { previewItemIdOf, previewTmdbIdOf, type TrailerPreviewRequest } from "../../../trailers/trailerPreview";
import { TtlLru } from "./ttlLru";

export interface PreviewTitle {
  /** La clé de la décision : la même pour tous les comptes qui voient ce titre. */
  key: string;
  /** Les bandes-annonces que Jellyfin connaît (`RemoteTrailers`). */
  jellyfin: JellyfinTrailer[];
  tmdb: { id: number; mediaType: "movie" | "tv" } | null;
}

/** `none` : rien à montrer pour ce compte ; `error` : Jellyfin n'a pas répondu (passager). */
export type TitleLookup = { kind: "title"; title: PreviewTitle } | { kind: "none" } | { kind: "error" };

interface ItemDto {
  Id?: string;
  Type?: string;
  SeriesId?: string;
  ProviderIds?: Record<string, string>;
  RemoteTrailers?: Array<{ Url?: string; Name?: string }>;
}

const LOOKUP_TTL_MS = 2 * 60 * 1000;
const lookups = new TtlLru<TitleLookup>(1000);
const inflight = new Map<string, Promise<TitleLookup>>();

async function readItem(itemId: string, userId: string): Promise<ItemDto | "missing" | "error"> {
  const result = await jellyfinAdminFetch<ItemDto>(
    `/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}&Fields=ProviderIds,RemoteTrailers`,
    { timeoutMs: 5_000 },
  );
  if (result.ok) return result.data;
  // 404 : un titre absent, ou que ce compte ne voit pas — pour lui, c'est pareil.
  return result.failure === "invalid" && (result.status === 404 || result.status === 400) ? "missing" : "error";
}

function titleOf(item: ItemDto): PreviewTitle | null {
  const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
  const id = previewItemIdOf(item.Id);
  if (!mediaType || !id) return null;
  const tmdbId = previewTmdbIdOf(item.ProviderIds?.Tmdb);
  return {
    key: `jf:${id}`,
    jellyfin: (item.RemoteTrailers ?? []).filter((t): t is JellyfinTrailer => typeof t.Url === "string" && t.Url !== ""),
    tmdb: tmdbId === null ? null : { id: tmdbId, mediaType },
  };
}

async function lookupItem(itemId: string, userId: string): Promise<TitleLookup> {
  const item = await readItem(itemId, userId);
  if (item === "error") return { kind: "error" };
  if (item === "missing") return { kind: "none" };
  // Un épisode, une saison : la bande-annonce est celle de la série (lue au même nom).
  const owner = (item.Type === "Episode" || item.Type === "Season") && item.SeriesId ? await readItem(item.SeriesId, userId) : item;
  if (owner === "error") return { kind: "error" };
  if (owner === "missing") return { kind: "none" };
  const title = titleOf(owner);
  return title ? { kind: "title", title } : { kind: "none" };
}

/** Le titre que la demande désigne, vu par `userId` ; deux demandes simultanées partagent la lecture. */
export function resolvePreviewTitle(request: TrailerPreviewRequest, userId: string): Promise<TitleLookup> {
  if (!("itemId" in request)) {
    const id = previewTmdbIdOf(request.tmdbId);
    if (id === null) return Promise.resolve({ kind: "none" });
    return Promise.resolve({ kind: "title", title: { key: `tmdb:${request.mediaType}:${id}`, jellyfin: [], tmdb: { id, mediaType: request.mediaType } } });
  }
  const cacheKey = `${userId}:${request.itemId}`;
  const known = lookups.get(cacheKey);
  if (known) return Promise.resolve(known);
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const task = lookupItem(request.itemId, userId)
    .then((lookup) => {
      // Une panne de Jellyfin ne se retient pas : la demande suivante relit.
      if (lookup.kind !== "error") lookups.set(cacheKey, lookup, LOOKUP_TTL_MS);
      return lookup;
    })
    .finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, task);
  return task;
}

/** Pour les tests : repartir d'une mémoire vide. */
export function resetPreviewTitles(): void {
  lookups.clear();
  inflight.clear();
}
