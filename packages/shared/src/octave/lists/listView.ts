/**
 * Octave — ce que montre une liste de titres (playlist, « Titres likés ») une
 * fois triée, filtrée et cherchée, et ce que devient son ordre après un
 * glisser. Pur : la règle de tri vient du contrat (`musicListOrder.ts`), la
 * vue n'y ajoute que la recherche, les filtres et le glisser.
 *
 * Le glisser part TOUJOURS de l'ordre affiché : trier par « Dernier ajout »
 * puis glisser un titre donne l'ordre personnalisé « dernier ajout, ce titre
 * déplacé » (demande de Damien, 26/10). Il n'existe pas pendant une recherche
 * ou un filtre : la place d'un titre parmi des titres cachés n'aurait pas de sens.
 */

import {
  customEntriesOf,
  listAlias,
  sortListItems,
  type MusicCustomEntry,
  type MusicListPrefs,
  type MusicListStats,
  type MusicListSubject,
  type MusicListNewcomers,
} from "../../music";
import type { ListRow } from "../pendingMerge";

export type ListFilter = "all" | "library" | "elsewhere" | "unplayed";
export const LIST_FILTERS: readonly ListFilter[] = ["all", "library", "elsewhere", "unplayed"];

export type StatsOf = (row: ListRow) => MusicListStats | null;

export function rowSubject(row: ListRow, stats: MusicListStats | null): MusicListSubject {
  const t = row.track;
  const artist = t.artists[0]?.name ?? "";
  return {
    key: t.key,
    title: t.title,
    artist,
    album: t.album?.title ?? "",
    disc: t.discNumber,
    track: t.trackNumber,
    durationMs: t.durationMs,
    year: t.year,
    // Un titre importé n'a souvent pas de MBID : « titre | artiste » le reconnaît quand il entre dans la bibliothèque.
    recording: listAlias(t.mbids.recording, t.title, artist),
    stats,
  };
}

/** Minuscules, sans accents ni ponctuation : « Beyoncé » se trouve en tapant « beyonce ». */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function searchTokens(query: string): string[] {
  const folded = foldText(query);
  return folded ? folded.split(" ") : [];
}

// Le texte replié d'un titre, calculé une fois par objet (une frappe ne replie pas 1 000 titres de nouveau).
const folded = new WeakMap<object, string>();

function haystackOf(row: ListRow): string {
  const t = row.track;
  let text = folded.get(t);
  if (text === undefined) {
    text = foldText([t.title, ...t.artists.map((a) => a.name), t.album?.title ?? ""].join(" "));
    folded.set(t, text);
  }
  return text;
}

/** Chaque mot tapé est dans le titre, un artiste ou l'album. */
export function rowMatches(row: ListRow, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = haystackOf(row);
  return tokens.every((token) => haystack.includes(token));
}

export function rowInFilter(row: ListRow, filter: ListFilter, stats: MusicListStats | null): boolean {
  switch (filter) {
    case "all":
      return true;
    case "library":
      return row.track.availability === "library";
    case "elsewhere":
      return row.track.availability !== "library";
    case "unplayed":
      return (stats?.plays ?? 0) === 0;
  }
}

/** Les filtres qui ont un sens pour CETTE liste (jamais une puce qui ne garde rien ou garde tout). */
export function usefulFilters(rows: readonly ListRow[], statsOf: StatsOf): ListFilter[] {
  const elsewhere = rows.some((r) => r.track.availability !== "library");
  const library = rows.some((r) => r.track.availability === "library");
  const played = rows.some((r) => (statsOf(r)?.plays ?? 0) > 0);
  const unplayed = rows.some((r) => (statsOf(r)?.plays ?? 0) === 0);
  return LIST_FILTERS.filter((f) => f === "all" || (f === "unplayed" ? played && unplayed : elsewhere && library));
}

export interface ListViewState {
  prefs: MusicListPrefs;
  query: string;
  filter: ListFilter;
  /** Une playlist partagée : un titre que mon ordre ne connaît pas va à la fin (`musicListOrder.ts`). */
  newcomers?: MusicListNewcomers;
}

/** La liste affichée : triée (l'ordre naturel départage), puis filtrée et cherchée. */
export function visibleListRows(natural: readonly ListRow[], statsOf: StatsOf, state: ListViewState): ListRow[] {
  const sorted = sortListItems(natural, (row) => rowSubject(row, statsOf(row)), state.prefs, state.newcomers);
  const tokens = searchTokens(state.query);
  if (tokens.length === 0 && state.filter === "all") return sorted;
  return sorted.filter((row) => rowInFilter(row, state.filter, statsOf(row)) && rowMatches(row, tokens));
}

/** Pourquoi le glisser n'est pas possible (`null` : il l'est). */
export function reorderBlock(state: ListViewState): "search" | "filter" | null {
  if (searchTokens(state.query).length > 0) return "search";
  return state.filter === "all" ? null : "filter";
}

/** L'ordre après avoir glissé la rangée `from` à la place `to` (rangs de la liste affichée). */
export function movedRows<T>(rows: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= rows.length) return [...rows];
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!);
  return next;
}

/** L'ordre affiché gardé comme ordre personnalisé ; une attente garde son identité (sa place survit à son entrée). */
export function customOf(rows: readonly ListRow[]): MusicCustomEntry[] {
  const pending = new Set(rows.filter((r) => r.pending).map((r) => r.track.key));
  return customEntriesOf(rows.map((r) => rowSubject(r, null)), (s) => pending.has(s.key));
}

/** Les entrées JELLYFIN dans l'ordre affiché (ce que la playlist elle-même doit devenir). */
export function jellyfinEntryOrder(rows: readonly ListRow[]): string[] {
  return rows.flatMap((r) => (r.entryId ? [r.entryId] : []));
}

/** Après un glisser : le tri passe à « Personnalisé », l'ordre de départ est celui qui était affiché. */
export function prefsAfterMove(prefs: MusicListPrefs, moved: readonly ListRow[]): MusicListPrefs {
  return { sort: "custom", direction: prefs.direction, custom: customOf(moved) };
}
