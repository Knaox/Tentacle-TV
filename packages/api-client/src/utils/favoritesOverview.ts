import type { MediaItem } from "@tentacle-tv/shared";

/**
 * La vue d'ensemble des titres likés — Mes favoris — EN MÉMOIRE.
 *
 * Deux usages, sur toutes les plateformes : le bilan de la collection (les
 * tuiles de l'en-tête, qui sont AUSSI des filtres rapides) et le regroupement
 * de la grille en sections. Les deux lisent la liste déjà chargée sous
 * `["favorites","all"]` — aucune requête, aucun champ en plus.
 *
 * Le regroupement n'ordonne jamais les titres À L'INTÉRIEUR d'une section : il
 * reçoit la liste déjà filtrée et triée par `filterCollection`, et en garde
 * l'ordre. Le tri choisi par l'utilisateur reste donc vrai dans chaque section.
 */

export type FavoriteWatchState = "resume" | "unplayed" | "played";

/**
 * L'état de visionnage d'un titre, sur la MÊME définition que le filtre de
 * statut de `filterCollection` (`IsResumable` / `IsUnplayed`) : un test verrouille
 * l'accord des deux, pour qu'une tuile « À reprendre » et le filtre du même nom
 * ne puissent pas compter deux choses différentes.
 */
export function favoriteWatchState(item: MediaItem): FavoriteWatchState {
  const data = item.UserData;
  if (data?.Played === true) return "played";
  if (item.Type === "Series") return (data?.PlayCount ?? 0) > 0 ? "resume" : "unplayed";
  const pct = data?.PlayedPercentage ?? 0;
  return (data?.PlaybackPositionTicks ?? 0) > 0 || (pct > 0 && pct < 100) ? "resume" : "unplayed";
}

export interface FavoritesSummary {
  total: number;
  movies: number;
  series: number;
  resume: number;
  unplayed: number;
  played: number;
  /** Durée cumulée des FILMS, en minutes — celle d'une série n'est que celle d'un épisode. */
  movieMinutes: number;
}

export function summarizeFavorites(items: readonly MediaItem[]): FavoritesSummary {
  const s: FavoritesSummary = { total: items.length, movies: 0, series: 0, resume: 0, unplayed: 0, played: 0, movieMinutes: 0 };
  for (const item of items) {
    if (item.Type === "Series") s.series++;
    else if (item.Type === "Movie") {
      s.movies++;
      s.movieMinutes += Math.round((item.RunTimeTicks ?? 0) / 600_000_000);
    }
    s[favoriteWatchState(item)]++;
  }
  return s;
}

export type FavoritesGroupMode = "none" | "type" | "status" | "genre" | "decade";

export const FAVORITES_GROUP_MODES: readonly FavoritesGroupMode[] = ["none", "type", "status", "genre", "decade"];

export function isFavoritesGroupMode(value: unknown): value is FavoritesGroupMode {
  return typeof value === "string" && (FAVORITES_GROUP_MODES as readonly string[]).includes(value);
}

/**
 * Une section de la grille. `value` est ce que l'appelant traduit : le type
 * (`Movie`, `Series`), l'état (`resume`…), le NOM du genre, ou la décennie
 * (`"1990"`). `null` = le reste (sans genre, sans année).
 */
export interface FavoritesGroup {
  key: string;
  mode: FavoritesGroupMode;
  value: string | null;
  items: MediaItem[];
}

const STATUS_ORDER: FavoriteWatchState[] = ["resume", "unplayed", "played"];

function bucket(items: readonly MediaItem[], keyOf: (item: MediaItem) => string | null): Map<string | null, MediaItem[]> {
  const map = new Map<string | null, MediaItem[]>();
  for (const item of items) {
    const k = keyOf(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function toGroups(mode: FavoritesGroup["mode"], map: Map<string | null, MediaItem[]>, order: (string | null)[]): FavoritesGroup[] {
  return order
    .filter((k) => (map.get(k)?.length ?? 0) > 0)
    .map((k) => ({ key: `${mode}:${k ?? "other"}`, mode, value: k, items: map.get(k)! }));
}

/**
 * Découper la liste en sections. `"none"` rend une seule section sans en-tête
 * (`[]` si la liste est vide) ; les sections vides ne sont jamais rendues.
 *
 * - type : Films puis Séries ;
 * - status : À reprendre, Pas encore vus, Déjà vus — l'ordre de l'action ;
 * - genre : le PREMIER genre du titre (celui que Jellyfin tient pour principal),
 *   sections par effectif décroissant, puis par nom ; les titres sans genre à la fin ;
 * - decade : de la plus récente à la plus ancienne ; sans année à la fin.
 */
export function groupFavorites(items: readonly MediaItem[], mode: FavoritesGroupMode): FavoritesGroup[] {
  if (mode === "none") {
    return items.length === 0 ? [] : [{ key: "none", mode: "none", value: null, items: [...items] }];
  }
  if (mode === "type") {
    const map = bucket(items, (i) => (i.Type === "Series" ? "Series" : "Movie"));
    return toGroups(mode, map, ["Movie", "Series"]);
  }
  if (mode === "status") {
    return toGroups(mode, bucket(items, favoriteWatchState), STATUS_ORDER);
  }
  if (mode === "genre") {
    const map = bucket(items, (i) => i.Genres?.find((g) => !!g) ?? null);
    const named = [...map.keys()].filter((k): k is string => k !== null);
    named.sort((a, b) => map.get(b)!.length - map.get(a)!.length || a.localeCompare(b, undefined, { sensitivity: "base" }));
    return toGroups(mode, map, [...named, null]);
  }
  const map = bucket(items, (i) => (i.ProductionYear ? String(Math.floor(i.ProductionYear / 10) * 10) : null));
  const decades = [...map.keys()].filter((k): k is string => k !== null).sort((a, b) => Number(b) - Number(a));
  return toGroups(mode, map, [...decades, null]);
}
