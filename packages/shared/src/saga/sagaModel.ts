/**
 * La rangée « saga » de la fiche d'un film, en logique pure : quels titres,
 * dans quel ordre, à quel rang, lequel est ouvert, lequel voir ensuite. Une
 * seule lecture pour le bureau, le miroir, le mobile et les téléviseurs.
 *
 * Deux sources se rejoignent : les films de la BIBLIOTHÈQUE (relus chez
 * Jellyfin, avec l'état « vu » du compte) et, quand un plugin sait le faire
 * (`search.collection`), les volets qui MANQUENT. L'ordre est celui de la
 * saga selon TMDB ; sans TMDB, la date de sortie.
 */

import type { MediaItem } from "../types/media";
import { withoutLibraryTwins, type ExternalSearchItem } from "../search/pluginSearch";
import { sortSagaParts, type SagaResponse } from "./sagaTypes";

/** Ce que la petite ligne d'une carte dit de plus que l'année. */
export type SagaCue = "current" | "resume" | "upNext";

export interface SagaLibraryEntry {
  kind: "library";
  key: string;
  item: MediaItem;
  /** Rang dans la saga (1 = le premier sorti) ; null sans TMDB. */
  position: number | null;
  cue: SagaCue | null;
}

export interface SagaExternalEntry {
  kind: "external";
  key: string;
  pluginId: string;
  item: ExternalSearchItem;
  position: number | null;
  /** « À suivre » : le prochain volet à voir est justement celui qui manque. */
  cue: "upNext" | null;
}

export type SagaEntry = SagaLibraryEntry | SagaExternalEntry;

export interface SagaView {
  /** Nom TMDB localisé (« Harry Potter - Saga ») ; null → titre générique. */
  name: string | null;
  entries: SagaEntry[];
  /** Volets de la saga, sortis ou annoncés ; null sans TMDB. */
  partCount: number | null;
  /** Titres de la saga que la bibliothèque a (et que le compte voit). */
  inLibrary: number;
  watched: number;
}

export interface SagaViewInput {
  response: SagaResponse | null | undefined;
  /** Les films de la bibliothèque relus chez Jellyfin, dans n'importe quel ordre. */
  items: readonly MediaItem[];
  /** Les volets absents, tels que chaque plugin les rend. */
  external?: ReadonlyArray<{ pluginId: string; items: readonly ExternalSearchItem[] }>;
  currentId: string;
}

/** Une clé de `ProviderIds` sans souci de casse, entier positif seulement. */
function providerNumber(ids: Record<string, string> | undefined, key: string): number | null {
  const wanted = key.toLowerCase();
  for (const [name, value] of Object.entries(ids ?? {})) {
    const id = Number(value);
    if (name.toLowerCase() === wanted && Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

/** L'identifiant TMDB de la saga d'un FILM, tel que Jellyfin l'a noté ; null sinon. */
export function sagaCollectionIdOf(item: MediaItem | null | undefined): number | null {
  return item?.Type === "Movie" ? providerNumber(item.ProviderIds, "TmdbCollection") : null;
}

const yearOf = (entry: SagaEntry): number | null =>
  entry.kind === "library"
    ? (entry.item.ProductionYear ?? (entry.item.PremiereDate ? new Date(entry.item.PremiereDate).getUTCFullYear() : null))
    : entry.item.year;

const titleOf = (entry: SagaEntry): string => (entry.kind === "library" ? entry.item.Name : entry.item.title);

/** Le rang d'abord, puis l'année, puis le titre ; ce qui n'a ni rang ni année ferme la marche. */
function compareEntries(a: SagaEntry, b: SagaEntry): number {
  const rank = (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);
  if (rank !== 0) return rank;
  const year = (yearOf(a) ?? Number.MAX_SAFE_INTEGER) - (yearOf(b) ?? Number.MAX_SAFE_INTEGER);
  return year !== 0 ? year : titleOf(a).localeCompare(titleOf(b));
}

const playedAt = (item: MediaItem): number => {
  const time = Date.parse(item.UserData?.LastPlayedDate ?? "");
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Le prochain à voir — les règles de l'épisode suivant (`getNextEpisode`),
 * sur la saga entière, volets manquants compris : un film ENTAMÉ se reprend ;
 * sinon le successeur du dernier VU (par date, à défaut par l'ordre) ; rien
 * de vu : le premier. Le dernier vu clôt la saga : plus rien à suivre.
 */
function nextKey(entries: readonly SagaEntry[]): { key: string; cue: "resume" | "upNext" } | null {
  const library = entries.filter((e): e is SagaLibraryEntry => e.kind === "library");
  const mostRecent = (list: SagaLibraryEntry[]) => list.reduce((best, e) => (playedAt(e.item) >= playedAt(best.item) ? e : best));
  const started = library.filter((e) => !e.item.UserData?.Played && (e.item.UserData?.PlaybackPositionTicks ?? 0) > 0);
  if (started.length > 0) return { key: mostRecent(started).key, cue: "resume" };
  const finished = library.filter((e) => e.item.UserData?.Played === true);
  if (finished.length === 0) return entries[0] ? { key: entries[0].key, cue: "upNext" } : null;
  const anchor = finished.some((e) => playedAt(e.item) > 0) ? mostRecent(finished) : finished[finished.length - 1];
  const after = entries[entries.indexOf(anchor) + 1];
  return after ? { key: after.key, cue: "upNext" } : null;
}

export function buildSagaView({ response, items, external = [], currentId }: SagaViewInput): SagaView | null {
  const parts = response?.saga ? sortSagaParts(response.saga.parts) : [];
  const rankOf = new Map(parts.map((part, index) => [part.tmdbId, index + 1]));
  const memberTmdb = new Map((response?.members ?? []).map((m) => [m.itemId, m.tmdbId]));

  const seen = new Set<string>();
  const owned = new Set<number>();
  const entries: SagaEntry[] = [];
  for (const item of items) {
    if (seen.has(item.Id)) continue;
    seen.add(item.Id);
    const tmdbId = memberTmdb.get(item.Id) ?? providerNumber(item.ProviderIds, "Tmdb");
    if (tmdbId !== null) owned.add(tmdbId);
    entries.push({ kind: "library", key: item.Id, item, position: tmdbId !== null ? (rankOf.get(tmdbId) ?? null) : null, cue: null });
  }

  const library = items.map((i) => ({ name: i.Name, year: i.ProductionYear ?? null }));
  for (const source of external) {
    for (const item of withoutLibraryTwins(source.items, library)) {
      const tmdbId = item.tmdbId ?? null;
      const key = tmdbId !== null ? `tmdb:${tmdbId}` : `${source.pluginId}:${item.id}`;
      if ((tmdbId !== null && owned.has(tmdbId)) || seen.has(key)) continue;
      seen.add(key);
      if (tmdbId !== null) owned.add(tmdbId);
      const position = tmdbId !== null ? (rankOf.get(tmdbId) ?? null) : null;
      entries.push({ kind: "external", key, pluginId: source.pluginId, item, position, cue: null });
    }
  }
  if (entries.length < 2) return null;
  entries.sort(compareEntries);

  const next = nextKey(entries);
  for (const entry of entries) {
    if (entry.kind === "library" && entry.item.Id === currentId) entry.cue = "current";
    else if (next !== null && entry.key === next.key) entry.cue = entry.kind === "library" ? next.cue : "upNext";
  }
  const inLibrary = entries.filter((e) => e.kind === "library").length;
  return {
    name: response?.saga?.name ?? null,
    entries,
    partCount: response?.saga ? parts.length + entries.filter((e) => e.position === null).length : null,
    inLibrary,
    watched: entries.filter((e) => e.kind === "library" && e.item.UserData?.Played === true).length,
  };
}
