/**
 * Octave — l'ordre d'une RUBRIQUE de la bibliothèque (albums, artistes,
 * playlists) : les FAVORIS en tête (« Vos favoris »), dans l'ordre personnel
 * du compte, puis le reste. Pur : le web, le bureau et le mobile lisent la
 * même règle (contrat `musicLibraryShelves.ts`).
 *
 * - Un favori que l'ordre ne connaît pas encore (posé depuis) arrive EN TÊTE,
 *   les nouveaux gardant entre eux l'ordre de la source.
 * - Le reste suit l'ordre de la source (le tri des albums, les noms des
 *   artistes) — sauf les playlists, toutes chargées, que l'ordre personnel
 *   range aussi (`orderRest`).
 * - Le drapeau `favorite` d'un élément de la liste (patché à chaque geste) est
 *   plus frais que la liste des favoris du serveur : il l'emporte.
 */

import { MUSIC_SHELF_ORDER_MAX } from "../../music/musicLibraryShelves";

export interface ShelfArrangement<T> {
  favorites: T[];
  rest: T[];
}

export interface ShelfInput<T> {
  /** Les favoris servis par le serveur (`MusicLibraryShelves`), dans n'importe quel ordre. */
  favorites: readonly T[];
  /** La liste de la rubrique (ses pages chargées, dans l'ordre de la source). */
  listing: readonly T[];
  keyOf: (item: T) => string;
  /** Le drapeau de l'élément : `true`, `false`, ou `undefined` (inconnu : serveur d'avant). */
  favoriteOf: (item: T) => boolean | undefined;
  /** L'ordre personnel de la rubrique (des clés). */
  order: readonly string[];
  /** Ranger aussi le reste par l'ordre personnel (les playlists). */
  orderRest: boolean;
}

/** Les éléments rangés par l'ordre : les inconnus d'abord (entre eux, l'ordre de la source), puis les connus à leur rang. */
export function orderByShelf<T>(items: readonly T[], keyOf: (item: T) => string, order: readonly string[]): T[] {
  if (order.length === 0) return [...items];
  const rank = new Map<string, number>();
  order.forEach((key, i) => {
    if (!rank.has(key)) rank.set(key, i);
  });
  return items
    .map((item, index) => ({ item, index, rank: rank.get(keyOf(item)) ?? -1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((d) => d.item);
}

/** La rubrique rangée : ses favoris en tête (une fois chacun), puis le reste, sans doublon. */
export function arrangeShelf<T>(input: ShelfInput<T>): ShelfArrangement<T> {
  const { keyOf, favoriteOf } = input;
  const listed = new Map<string, T>();
  for (const item of input.listing) if (!listed.has(keyOf(item))) listed.set(keyOf(item), item);
  const favorites: T[] = [];
  const taken = new Set<string>();
  const take = (item: T) => {
    const key = keyOf(item);
    if (taken.has(key)) return;
    // L'objet de la liste est le plus frais (un geste le patche) ; un favori retiré n'en est plus un.
    const fresh = listed.get(key) ?? item;
    if (favoriteOf(fresh) === false) return;
    taken.add(key);
    favorites.push(fresh);
  };
  for (const item of input.favorites) take(item);
  for (const item of input.listing) if (favoriteOf(item) === true) take(item);
  const rest = [...listed.values()].filter((item) => !taken.has(keyOf(item)));
  return {
    favorites: orderByShelf(favorites, keyOf, input.order),
    rest: input.orderRest ? orderByShelf(rest, keyOf, input.order) : rest,
  };
}

/**
 * L'ordre à garder après un geste dans UNE section affichée (`section` : ses clés dans l'ordre affiché). Les clés
 * des autres sections affichées (`keep` : le reste des playlists) gardent leur rang relatif ; les clés qui ne sont
 * plus montrées nulle part sont oubliées.
 */
function reordered(order: readonly string[], section: readonly string[], keep: readonly string[]): string[] {
  const own = new Set(section);
  const kept = new Set(keep);
  const others = order.filter((k) => kept.has(k) && !own.has(k));
  return [...section, ...others].slice(0, MUSIC_SHELF_ORDER_MAX);
}

/** Déplacer `key` à l'index `to` de sa section (un glisser). L'ordre inchangé si la clé n'y est pas. */
export function shelfOrderAfterMove(order: readonly string[], section: readonly string[], key: string, to: number, keep: readonly string[] = []): string[] {
  const from = section.indexOf(key);
  if (from < 0) return [...order];
  const next = section.filter((k) => k !== key);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, key);
  return reordered(order, next, keep);
}

/** « Mettre en haut » : la clé en tête de sa section. */
export function shelfOrderToTop(order: readonly string[], section: readonly string[], key: string, keep: readonly string[] = []): string[] {
  return shelfOrderAfterMove(order, section, key, 0, keep);
}

/** « Mettre en haut » n'a de sens que pour ce qui n'y est pas déjà. */
export function canMoveToTop(section: readonly string[], key: string): boolean {
  return section.indexOf(key) > 0;
}

/** Au plus `max` playlists favorites, dans l'ordre personnel : l'accès rapide de l'accueil. */
export function homeFavoritePlaylists<T>(favorites: readonly T[], keyOf: (item: T) => string, order: readonly string[], max = 8): T[] {
  return orderByShelf(favorites, keyOf, order).slice(0, max);
}
