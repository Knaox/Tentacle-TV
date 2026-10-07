/**
 * Une liste STABLE d'une réponse à l'autre : chaque élément qui dit la même
 * chose que celui de même clé dans la liste précédente garde l'OBJET
 * précédent, et une liste dont rien n'a changé (mêmes éléments, même ordre)
 * garde le TABLEAU précédent. Les listes de cartes sont mémoïsées : une
 * réponse qui ne change que quelques titres ne redessine que ceux-là (les
 * résultats d'une frappe, une rangée relue).
 *
 * Pur : `same` dit si deux éléments de même clé sont équivalents.
 */

export interface StableList<T> {
  items: readonly T[];
  byKey: ReadonlyMap<string, T>;
}

export function stabilizeList<T>(
  previous: StableList<T> | null | undefined,
  next: readonly T[],
  keyOf: (item: T) => string,
  same: (a: T, b: T) => boolean,
): StableList<T> {
  const byKey = new Map<string, T>();
  const items = next.map((item) => {
    const key = keyOf(item);
    const old = previous?.byKey.get(key);
    const kept = old !== undefined && same(old, item) ? old : item;
    if (!byKey.has(key)) byKey.set(key, kept);
    return kept;
  });
  const before = previous?.items;
  if (before && before.length === items.length && before.every((item, i) => item === items[i])) {
    return { items: before, byKey };
  }
  return { items, byKey };
}
