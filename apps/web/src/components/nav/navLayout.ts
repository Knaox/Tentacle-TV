/**
 * La disposition de la barre desktop : l'ORDRE des destinations, et celles
 * qu'on en a RETIRÉES. Module pur — l'état est passé en argument, les tests
 * n'ont besoin ni de React ni de stockage.
 *
 * Deux listes, et pas une liste « ce qui est dans la barre » :
 *
 * - `hidden` est une liste d'EXCLUSION, pour ce qui y figure par défaut
 *   (l'accueil, « Pour vous », les bibliothèques). Vide, elle veut dire « tout
 *   est là » — le bon comportement dès la première ouverture, et une
 *   bibliothèque créée demain y apparaît d'elle-même, sans rien à régler.
 *   Même choix, et même raison, que le rail du téléviseur (`railPinning`).
 * - `order` est l'ordre CHOISI. Vide : l'ordre par défaut. Une destination
 *   qu'il ne connaît pas (créée depuis) se range à la suite ; une clé qui ne
 *   correspond plus à rien s'ignore.
 *
 * Ma liste, Mes favoris et les pages d'extensions gardent leur épinglage à
 * part (`usePinnedNav`) : le mobile le lit aussi.
 */

export type NavEntryKind = "core" | "library" | "list" | "extension";

export interface NavLayout {
  order: string[];
  hidden: string[];
}

export const EMPTY_LAYOUT: NavLayout = { order: [], hidden: [] };

/** Range les entrées dans l'ordre choisi ; les inconnues suivent, dans leur ordre par défaut. */
export function applyOrder<T extends { key: string }>(entries: readonly T[], order: readonly string[]): T[] {
  if (order.length === 0) return [...entries];
  const rank = new Map(order.map((key, index) => [key, index]));
  const known = entries.filter((e) => rank.has(e.key)).sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
  const fresh = entries.filter((e) => !rank.has(e.key));
  return [...known, ...fresh];
}

/**
 * L'ordre complet après un réordonnancement de la barre : les épinglées
 * d'abord, dans l'ordre voulu ; les autres ensuite, dans le leur. Seul
 * l'ordre des épinglées se voit — celui des autres ne sert qu'au jour où on
 * les épingle.
 */
export function reorderPinned(allKeys: readonly string[], pinnedInOrder: readonly string[]): string[] {
  const pinned = new Set(pinnedInOrder);
  return [...pinnedInOrder, ...allKeys.filter((key) => !pinned.has(key))];
}

/** Monte (−1) ou descend (+1) une épinglée d'un cran ; aux bords, rien ne bouge. */
export function nudge(pinnedKeys: readonly string[], key: string, delta: -1 | 1): string[] {
  const from = pinnedKeys.indexOf(key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= pinnedKeys.length) return [...pinnedKeys];
  const next = [...pinnedKeys];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Épingler : la destination rejoint la FIN de la barre — là où l'œil la cherche. */
export function appendPinned(allKeys: readonly string[], pinnedKeys: readonly string[], key: string): string[] {
  return reorderPinned(allKeys, [...pinnedKeys.filter((k) => k !== key), key]);
}

/** Retire ou rend une destination affichée par défaut. */
export function withHidden(hidden: readonly string[], key: string, hide: boolean): string[] {
  const rest = hidden.filter((k) => k !== key);
  return hide ? [...rest, key] : rest;
}

/** Lecture tolérante de l'état stocké : un JSON abîmé vaut « rien de choisi ». */
export function parseLayout(raw: string | null): NavLayout {
  if (!raw) return EMPTY_LAYOUT;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof NavLayout, unknown>>;
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : []);
    return { order: strings(value.order), hidden: strings(value.hidden) };
  } catch {
    return EMPTY_LAYOUT;
  }
}
