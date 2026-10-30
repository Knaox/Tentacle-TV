/**
 * Octave — l'HISTORIQUE de la recherche, par COMPTE. Capacité
 * `music.searchHistory` (1.41.0).
 *
 * Fichier du CONTRAT, recopié octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`). Pur : ni React, ni DOM, ni horloge (la
 * date du moment est passée).
 *
 * - Les RECHERCHES récentes : le texte validé (clavier, suggestion choisie),
 *   comparé sans casse ni espaces doublés, la forme tapée gardée.
 * - Les TITRES récemment recherchés : un titre LANCÉ depuis les résultats d'une
 *   recherche, avec ce qu'il faut pour le montrer (pochette) et le relancer
 *   (l'INSTANTANÉ du titre, que le cœur ne fait que garder : il ne l'analyse
 *   pas au-delà de sa forme).
 * - Le plus récent en tête, une entrée une fois ; le serveur en garde
 *   `MUSIC_SEARCH_HISTORY_MAX` de chaque sorte. Effacer : une entrée, ou tout.
 *
 * Sans la capacité, chaque appareil garde le sien (`pages/recentMusicSearches`,
 * `pages/recentSearchTracks`), comme avant.
 */

import type { MusicTrack } from "./musicTypes";

export const MUSIC_SEARCH_HISTORY_ROUTES = {
  /** GET — l'historique du compte (`MusicSearchHistory`) ; POST `MusicSearchHistoryAdd` — y ajoute des entrées. */
  history: "/api/music/search-history",
  /** POST `MusicSearchHistoryForget` — retire une entrée, ou tout. */
  forget: "/api/music/search-history/forget",
} as const;

/** Ce que le serveur garde de chaque sorte (les clients en montrent moins). */
export const MUSIC_SEARCH_HISTORY_MAX = 20;
/** Une requête : 2 à 200 caractères une fois les espaces resserrés. */
export const MUSIC_SEARCH_QUERY_MIN = 2;
export const MUSIC_SEARCH_QUERY_MAX = 200;
/** L'instantané d'un titre, en JSON : au-delà, refusé. */
export const MUSIC_SEARCH_TRACK_SNAPSHOT_MAX = 8_192;

export interface MusicSearchQueryEntry {
  text: string;
  /** Millisecondes UTC. */
  at: number;
}

export interface MusicSearchTrackEntry {
  track: MusicTrack;
  at: number;
}

/** `GET /api/music/search-history` — le plus récent en tête. */
export interface MusicSearchHistory {
  queries: MusicSearchQueryEntry[];
  tracks: MusicSearchTrackEntry[];
}

/** `POST /api/music/search-history` — une recherche validée, un titre lancé, ou l'historique d'un appareil à verser. */
export interface MusicSearchHistoryAdd {
  queries?: MusicSearchQueryEntry[];
  tracks?: MusicSearchTrackEntry[];
}

export type MusicSearchHistoryForget = { kind: "query"; text: string } | { kind: "track"; key: string } | { kind: "all" };

export const EMPTY_SEARCH_HISTORY: MusicSearchHistory = { queries: [], tracks: [] };

/** La forme gardée d'une requête (espaces resserrés), `null` si trop courte, trop longue ou pas du texte. */
export function normalizeSearchQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= MUSIC_SEARCH_QUERY_MIN && text.length <= MUSIC_SEARCH_QUERY_MAX ? text : null;
}

/** Deux requêtes sont la même sans casse (« Daft Punk » = « daft punk »). */
export function searchQueryKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Un instantané de titre acceptable : sa forme (clé, titre, artistes) et sa taille, rien de plus. */
export function isSearchTrackSnapshot(value: unknown): value is MusicTrack {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const t = value as Partial<MusicTrack>;
  if (typeof t.key !== "string" || t.key.length === 0 || t.key.length > 300) return false;
  if (typeof t.title !== "string" || !Array.isArray(t.artists)) return false;
  try {
    return JSON.stringify(value).length <= MUSIC_SEARCH_TRACK_SNAPSHOT_MAX;
  } catch {
    return false;
  }
}

/** Une date reçue : un nombre fini, jamais dans le futur (horloge d'un appareil en avance), sinon `now`. */
function dateOf(value: unknown, now: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(value, now) : now;
}

/** Le corps d'un `POST` : entrées valides seulement (au plus `MUSIC_SEARCH_HISTORY_MAX` de chaque) ; `null` s'il est mal formé. */
export function parseSearchHistoryAdd(body: unknown, now: number): MusicSearchHistory | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { queries = [], tracks = [] } = body as { queries?: unknown; tracks?: unknown };
  if (!Array.isArray(queries) || !Array.isArray(tracks)) return null;
  if (queries.length > MUSIC_SEARCH_HISTORY_MAX || tracks.length > MUSIC_SEARCH_HISTORY_MAX) return null;
  const outQueries: MusicSearchQueryEntry[] = [];
  for (const entry of queries) {
    const text = normalizeSearchQuery((entry as { text?: unknown } | null)?.text);
    if (text !== null) outQueries.push({ text, at: dateOf((entry as { at?: unknown }).at, now) });
  }
  const outTracks: MusicSearchTrackEntry[] = [];
  for (const entry of tracks) {
    const track = (entry as { track?: unknown } | null)?.track;
    if (isSearchTrackSnapshot(track)) outTracks.push({ track, at: dateOf((entry as { at?: unknown }).at, now) });
  }
  return { queries: outQueries, tracks: outTracks };
}

/** Le corps d'un « effacer », `null` s'il est mal formé. */
export function parseSearchHistoryForget(body: unknown): MusicSearchHistoryForget | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { kind?: unknown; text?: unknown; key?: unknown };
  if (b.kind === "all") return { kind: "all" };
  if (b.kind === "query" && typeof b.text === "string" && b.text.trim() !== "") return { kind: "query", text: b.text };
  if (b.kind === "track" && typeof b.key === "string" && b.key !== "") return { kind: "track", key: b.key };
  return null;
}

function newestFirst<T extends { at: number }>(list: readonly T[], keyOf: (entry: T) => string, max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of [...list].sort((a, b) => b.at - a.at)) {
    const key = keyOf(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
}

/** Ajoute des entrées : la plus récente de chaque clé gagne, le plus récent en tête, `max` de chaque sorte. */
export function mergeSearchHistory(current: MusicSearchHistory, add: MusicSearchHistoryAdd, max = MUSIC_SEARCH_HISTORY_MAX): MusicSearchHistory {
  return {
    queries: newestFirst([...(add.queries ?? []), ...current.queries], (e) => searchQueryKey(e.text), max),
    tracks: newestFirst([...(add.tracks ?? []), ...current.tracks], (e) => e.track.key, max),
  };
}

/** Retire une entrée (ou tout). */
export function forgetInSearchHistory(current: MusicSearchHistory, forget: MusicSearchHistoryForget): MusicSearchHistory {
  if (forget.kind === "all") return EMPTY_SEARCH_HISTORY;
  if (forget.kind === "query") {
    const key = searchQueryKey(forget.text);
    return { ...current, queries: current.queries.filter((e) => searchQueryKey(e.text) !== key) };
  }
  return { ...current, tracks: current.tracks.filter((e) => e.track.key !== forget.key) };
}
